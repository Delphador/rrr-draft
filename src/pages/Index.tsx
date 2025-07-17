import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { CHARACTERS, Character } from "@/data/characters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TeamCompositionDialog from "@/components/TeamCompositionDialog";
import RoomStatePanel from "@/components/RoomStatePanel";
import GameLogPanel from "@/components/GameLogPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Progress } from "@/components/ui/progress";
import ChatPanel from "@/components/ChatPanel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { XCircle, PlusCircle, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from 'uuid';

type TurnAction = 'ban' | 'pick';
type Team = 'Team 1' | 'Team 2';

interface Turn {
  type: TurnAction;
  team: Team;
}

interface GameModeConfig {
  name: string;
  pickBanOrder: Turn[];
  teamPickLimit: number;
  totalBanLimit: number;
}

interface RegisteredUser {
  id: string;
  nickname: string;
  role: 'captain' | 'spectator';
  team?: 'Team 1' | 'Team 2';
}

interface GameState {
  id: string; // This will be the room_id
  room_id: string;
  team1_bans: Character[];
  team2_bans: Character[];
  team1_picks: Character[];
  team2_picks: Character[];
  current_turn_index: number;
  timer_start_time: string; // ISO string
  game_started: boolean;
  game_log: string[];
  created_at: string;
  updated_at: string;
}

const gameModes: Record<string, GameModeConfig> = {
  '3v3': {
    name: '3x3',
    pickBanOrder: [
      { type: 'ban', team: 'Team 1' },
      { type: 'ban', team: 'Team 2' },
      { type: 'ban', team: 'Team 1' },
      { type: 'ban', team: 'Team 2' },
      { type: 'pick', team: 'Team 1' },
      { type: 'pick', team: 'Team 2' },
      { type: 'pick', team: 'Team 2' },
      { type: 'pick', team: 'Team 1' },
      { type: 'ban', team: 'Team 1' },
      { type: 'ban', team: 'Team 2' },
      { type: 'pick', team: 'Team 1' },
      { type: 'pick', team: 'Team 2' },
    ],
    teamPickLimit: 3,
    totalBanLimit: 6,
  },
  '2v2': {
    name: '2x2',
    pickBanOrder: [
      { type: 'ban', team: 'Team 1' },
      { type: 'ban', team: 'Team 2' },
      { type: 'ban', team: 'Team 1' },
      { type: 'ban', team: 'Team 2' },
      { type: 'pick', team: 'Team 1' },
      { type: 'pick', team: 'Team 2' },
      { type: 'ban', team: 'Team 1' },
      { type: 'ban', team: 'Team 2' },
      { type: 'pick', team: 'Team 2' },
      { type: 'pick', team: 'Team 1' },
    ],
    teamPickLimit: 2,
    totalBanLimit: 6,
  },
};

const generateShortCode = (length: number = 6): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const Index = () => {
  const [isUserRegistered, setIsUserRegistered] = useState(false);
  const [nickname, setNickname] = useState('');
  const [selectedRole, setSelectedRole] = useState<'captain' | 'spectator' | ''>('');
  const [selectedTeam, setSelectedTeam] = useState<'Team 1' | 'Team 2' | ''>('');
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null); // This will always be the UUID
  const [roomName, setRoomName] = useState('');
  const [roomShortCode, setRoomShortCode] = useState<string | null>(null);
  const [isRoomJoined, setIsRoomJoined] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // ID of the current user's room_users entry
  const [roomInput, setRoomInput] = useState<string>(''); // New state for the room ID/code input field

  const [gameState, setGameState] = useState<GameState | null>(null);

  const registeredCaptains = useMemo(() => ({
    'Team 1': registeredUsers.some(u => u.role === 'captain' && u.team === 'Team 1'),
    'Team 2': registeredUsers.some(u => u.role === 'captain' && u.team === 'Team 2'),
  }), [registeredUsers]);

  const [selectedModeKey, setSelectedModeKey] = useState<string>('3v3');
  const currentModeConfig = useMemo(() => gameModes[selectedModeKey], [selectedModeKey]);

  // Derived state from gameState
  const gameStarted = gameState?.game_started || false;
  const team1Bans = gameState?.team1_bans || [];
  const team2Bans = gameState?.team2_bans || [];
  const team1Picks = gameState?.team1_picks || [];
  const team2Picks = gameState?.team2_picks || [];
  const currentTurnIndex = gameState?.current_turn_index || 0;
  const gameLog = gameState?.game_log || [];

  // Local timer state, will be synced with timer_start_time from Supabase
  const [localTimer, setLocalTimer] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showTeamCompositionDialog, setShowTeamCompositionDialog] = useState(false);

  const currentTurn = useMemo<Turn | null>(() => {
    if (currentTurnIndex < currentModeConfig.pickBanOrder.length) {
      return currentModeConfig.pickBanOrder[currentTurnIndex];
    }
    return null;
  }, [currentTurnIndex, currentModeConfig.pickBanOrder]);

  const getTimerDuration = (turnIndex: number) => {
    if (turnIndex === 0 || turnIndex === 1) {
      return 60;
    }
    return 30;
  };

  const gameEnded = currentTurnIndex >= currentModeConfig.pickBanOrder.length;

  const availableCharacters = useMemo(() => {
    const allSelectedIds = new Set([
      ...team1Bans.map(c => c.id),
      ...team2Bans.map(c => c.id),
      ...team1Picks.map(c => c.id),
      ...team2Picks.map(c => c.id),
    ]);
    return CHARACTERS.filter(char => !allSelectedIds.has(char.id));
  }, [team1Bans, team2Bans, team1Picks, team2Picks]);

  const canPerformAction = useMemo(() => {
    if (!gameStarted || gameEnded || !currentTurn) return false;
    if (selectedRole === 'spectator') return false;
    if (selectedRole === 'captain' && currentTurn.team === selectedTeam) return true;
    return false;
  }, [gameStarted, gameEnded, currentTurn, selectedRole, selectedTeam]);

  // Function to update game state in Supabase
  const updateGameStateInSupabase = useCallback(async (updates: Partial<GameState>) => {
    if (!roomId) {
      console.error("Cannot update game state: roomId is null.");
      return;
    }
    const { error } = await supabase
      .from('game_states')
      .update(updates)
      .eq('room_id', roomId); // Use room_id as the primary key for game_states

    if (error) {
      console.error("Error updating game state:", error);
      toast.error("Ошибка при обновлении состояния игры.");
    }
  }, [roomId]);

  const handleCharacterAction = useCallback(async (character: Character, isRandom: boolean = false): Promise<boolean> => {
    if (!gameState || !currentTurn) {
      if (!isRandom) toast.info("Игра завершена или не начата!");
      return false;
    }

    const isAlreadySelected = team1Bans.some(c => c.id === character.id) ||
                              team2Bans.some(c => c.id === character.id) ||
                              team1Picks.some(c => c.id === character.id) ||
                              team2Picks.some(c => c.id === character.id);

    if (isAlreadySelected) {
      if (!isRandom) toast.error("Этот персонаж уже выбран или забанен.");
      return false;
    }

    const team1BanLimit = currentModeConfig.pickBanOrder.filter(turn => turn.type === 'ban' && turn.team === 'Team 1').length;
    const team2BanLimit = currentModeConfig.pickBanOrder.filter(turn => turn.type === 'ban' && turn.team === 'Team 2').length;

    let newTeam1Bans = [...team1Bans];
    let newTeam2Bans = [...team2Bans];
    let newTeam1Picks = [...team1Picks];
    let newTeam2Picks = [...team2Picks];
    let newGameLog = [...gameLog];
    let logMessage = '';
    let actionSuccessful = false;

    if (currentTurn.type === 'ban') {
      if (currentTurn.team === 'Team 1') {
        if (newTeam1Bans.length >= team1BanLimit) {
          if (!isRandom) toast.error(`Команда 1 уже забанила ${team1BanLimit} персонажей.`);
          return false;
        }
        newTeam1Bans.push(character);
        logMessage = `${currentTurn.team} ${isRandom ? 'автоматически забанил' : 'забанил'} ${character.name}.`;
        actionSuccessful = true;
      } else {
        if (newTeam2Bans.length >= team2BanLimit) {
          if (!isRandom) toast.error(`Команда 2 уже забанила ${team2BanLimit} персонажей.`);
          return false;
        }
        newTeam2Bans.push(character);
        logMessage = `${currentTurn.team} ${isRandom ? 'автоматически забанил' : 'забанил'} ${character.name}.`;
        actionSuccessful = true;
      }
    } else { // type === 'pick'
      if (currentTurn.team === 'Team 1') {
        if (newTeam1Picks.length >= currentModeConfig.teamPickLimit) {
          if (!isRandom) toast.error(`Команда 1 уже выбрала ${currentModeConfig.teamPickLimit} персонажей.`);
          return false;
        }
        newTeam1Picks.push(character);
        logMessage = `${currentTurn.team} ${isRandom ? 'автоматически выбрал' : 'выбрал'} ${character.name}.`;
        actionSuccessful = true;
      } else {
        if (newTeam2Picks.length >= currentModeConfig.teamPickLimit) {
          if (!isRandom) toast.error(`Команда 2 уже выбрала ${currentModeConfig.teamPickLimit} персонажей.`);
          return false;
        }
        newTeam2Picks.push(character);
        logMessage = `${currentTurn.team} ${isRandom ? 'автоматически выбрал' : 'выбрал'} ${character.name}.`;
        actionSuccessful = true;
      }
    }

    if (actionSuccessful) {
      newGameLog.push(logMessage);
      await updateGameStateInSupabase({
        team1_bans: newTeam1Bans,
        team2_bans: newTeam2Bans,
        team1_picks: newTeam1Picks,
        team2_picks: newTeam2Picks,
        current_turn_index: currentTurnIndex + 1,
        timer_start_time: new Date().toISOString(), // Reset timer for next turn
        game_log: newGameLog,
      });
      toast.success(logMessage);
    }
    return actionSuccessful;
  }, [gameState, currentTurn, team1Bans, team2Bans, team1Picks, team2Picks, gameLog, currentTurnIndex, currentModeConfig.pickBanOrder, currentModeConfig.teamPickLimit, updateGameStateInSupabase]);

  const handleManualCharacterSelection = useCallback(async (character: Character) => {
    if (canPerformAction) {
      await handleCharacterAction(character, false);
    } else {
      toast.error("Вы не можете совершить это действие сейчас.");
    }
  }, [canPerformAction, handleCharacterAction]);

  const handleTimerExpiryOrRandomPick = useCallback(async () => {
    if (!gameState || !currentTurn) {
      toast.info("Игра завершена!");
      return;
    }

    // Inform the user if they are not the active player, but don't prevent the automatic action
    if (selectedRole === 'spectator') {
      toast.warning("Зрители не могут делать выбор. Автоматический выбор будет произведен.");
    } else if (selectedRole === 'captain' && currentTurn.team !== selectedTeam) {
      toast.warning("Сейчас ход другой команды. Автоматический выбор будет произведен.");
    }

    if (availableCharacters.length === 0) {
      toast.error("Нет доступных персонажей для случайного выбора.");
      // Still advance turn if no characters left
      await updateGameStateInSupabase({
        current_turn_index: currentTurnIndex + 1,
        timer_start_time: new Date().toISOString(),
        game_log: [...gameLog, `Автоматический пропуск хода для ${currentTurn.team} (нет доступных персонажей).`]
      });
      return;
    } else {
      const randomIndex = Math.floor(Math.random() * availableCharacters.length);
      const randomCharacter = availableCharacters[randomIndex];
      await handleCharacterAction(randomCharacter, true); // Always attempt the automatic action
    }
  }, [gameState, currentTurn, availableCharacters, selectedRole, selectedTeam, handleCharacterAction, currentTurnIndex, gameLog, updateGameStateInSupabase]);

  const resetGame = useCallback(async () => {
    if (!roomId) {
      toast.error("Нет активной комнаты для сброса.");
      return;
    }

    // Reset game state in DB
    const { error: gameResetError } = await supabase
      .from('game_states')
      .update({
        team1_bans: [],
        team2_bans: [],
        team1_picks: [],
        team2_picks: [],
        current_turn_index: 0,
        timer_start_time: new Date().toISOString(),
        game_started: false,
        game_log: [],
      })
      .eq('room_id', roomId);

    if (gameResetError) {
      console.error("Error resetting game state:", gameResetError);
      toast.error("Ошибка при сбросе состояния игры.");
      return;
    }

    // Clear local state related to user registration and room
    setIsUserRegistered(false);
    setNickname('');
    setSelectedRole('');
    setSelectedTeam('');
    setRegisteredUsers([]); // This will be re-fetched by subscription
    setRoomId(null); // This will trigger re-render and show room creation/join
    setRoomName('');
    setRoomShortCode(null);
    setIsRoomJoined(false);
    setCurrentUserId(null);
    setGameState(null); // Clear local game state
    setRoomInput(''); // Clear room input field

    toast.info("Игра и регистрация сброшены.");
  }, [roomId]);

  const handleStartGame = async () => {
    if (!roomId) {
      toast.error("Сначала создайте или присоединитесь к комнате.");
      return;
    }
    // Добавлена проверка: только капитан может начать игру
    if (selectedRole !== 'captain') {
      toast.error("Только капитан может начать игру.");
      return;
    }
    if (!selectedTeam) {
      toast.error("Капитан должен выбрать команду, чтобы начать игру.");
      return;
    }

    // Update existing game state to start the game
    const { error: updateError } = await supabase
      .from('game_states')
      .update({
        game_started: true,
        current_turn_index: 0,
        timer_start_time: new Date().toISOString(),
        team1_bans: [],
        team2_bans: [],
        team1_picks: [],
        team2_picks: [],
        game_log: [`Игра началась в режиме ${currentModeConfig.name}.`]
      })
      .eq('room_id', roomId);
      // Removed .select().single() to avoid 406 error and rely on Realtime subscription

    if (updateError) {
      console.error("Error updating game state to start:", updateError);
      toast.error("Ошибка при запуске игры.");
      return;
    }

    // No need to setGameState here, Realtime subscription will handle it
    toast.success("Игра началась!");
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast.error("Пожалуйста, введите название комнаты.");
      return;
    }

    let newShortCode = generateShortCode();
    let isUnique = false;
    for (let i = 0; i < 5; i++) {
      const { data: existingRoom, error: checkError } = await supabase
        .from('rooms')
        .select('id')
        .eq('short_code', newShortCode); // Removed .single()

      if (checkError) {
        // If error is PGRST116 (no rows found), it's unique
        if (checkError.code === 'PGRST116') {
          isUnique = true;
          break;
        } else {
          console.error("Error checking short code uniqueness:", checkError);
          toast.error("Ошибка при проверке уникальности короткого кода.");
          return;
        }
      } else if (existingRoom && existingRoom.length === 0) { // Check if data is empty
        isUnique = true;
        break;
      } else if (existingRoom && existingRoom.length > 0) { // Room found, generate new code
        newShortCode = generateShortCode();
      }
    }

    if (!isUnique) {
      toast.error("Не удалось сгенерировать уникальный короткий код. Попробуйте еще раз.");
      return;
    }

    const { data, error } = await supabase
      .from('rooms')
      .insert([{ name: roomName.trim(), short_code: newShortCode }])
      .select();

    if (error) {
      console.error("Error creating room:", error);
      toast.error("Ошибка при создании комнаты.");
      return;
    }
    if (data && data.length > 0) {
      const createdRoomId = data[0].id;
      setRoomId(createdRoomId); // Set the UUID
      setRoomName(data[0].name);
      setRoomShortCode(data[0].short_code);
      setIsRoomJoined(true);
      toast.success(`Комната "${data[0].name}" создана! Код: ${data[0].short_code}`);

      // Insert initial game state for the new room
      const { error: gameStateInsertError } = await supabase
        .from('game_states')
        .insert({
          id: createdRoomId, // id of game_states is the same as room_id
          room_id: createdRoomId,
          game_started: false, // Game not started yet
          timer_start_time: new Date().toISOString(),
          game_log: [`Комната "${data[0].name}" создана. Ожидание начала игры.`]
        }); // Removed .select().single()

      if (gameStateInsertError) {
        console.error("Error inserting initial game state for new room:", gameStateInsertError);
        toast.error("Ошибка при инициализации состояния игры для новой комнаты.");
      }
      // No setGameState here, rely on subscription
    }
  };

  const handleJoinRoom = async () => {
    if (!roomInput.trim()) { // Use roomInput here
      toast.error("Пожалуйста, введите ID или код комнаты.");
      return;
    }

    let roomData = null;
    let error = null;

    // Attempt to join by UUID
    if (roomInput.trim().length === 36 && roomInput.trim().includes('-')) { // Use roomInput here
      const { data, error: uuidError } = await supabase
        .from('rooms')
        .select('id, name, short_code')
        .eq('id', roomInput.trim()); // Removed .single()
      
      if (uuidError && uuidError.code !== 'PGRST116') { // Handle actual errors, not just no rows
        error = uuidError;
      } else if (data && data.length > 0) {
        roomData = data[0];
      }
    }

    // If not found by UUID or it's not a UUID, try by short_code
    if (!roomData && (!error || error.code === 'PGRST116')) { // Only try short code if UUID failed or was not a UUID
      const { data, error: shortCodeError } = await supabase
        .from('rooms')
        .select('id, name, short_code')
        .eq('short_code', roomInput.trim()); // Removed .single()
      
      if (shortCodeError && shortCodeError.code !== 'PGRST116') {
        error = shortCodeError;
      } else if (data && data.length > 0) {
        roomData = data[0];
      }
    }

    if (error || !roomData) {
      console.error("Error joining room:", error);
      toast.error("Комната с таким ID или кодом не найдена.");
      return;
    }

    setRoomId(roomData.id); // Set the UUID
    setRoomName(roomData.name);
    setRoomShortCode(roomData.short_code);
    setIsRoomJoined(true);
    toast.success(`Вы присоединились к комнате "${roomData.name}".`);

    // Fetch initial game state for the joined room
    const { data: initialGameState, error: fetchGameStateError } = await supabase
      .from('game_states')
      .select('*')
      .eq('room_id', roomData.id);

    if (fetchGameStateError && fetchGameStateError.code !== 'PGRST116') {
      console.error("Error fetching initial game state on join:", fetchGameStateError);
      toast.error("Ошибка при получении состояния игры.");
    } else if (initialGameState && initialGameState.length > 0) {
      setGameState(initialGameState[0] as GameState);
    } else {
      // If no game state exists, create a default one (should ideally be created with room)
      const { error: insertError } = await supabase
        .from('game_states')
        .insert({
          id: roomData.id,
          room_id: roomData.id,
          game_started: false,
          timer_start_time: new Date().toISOString(),
          game_log: [`Комната "${roomData.name}" создана. Ожидание начала игры.`]
        }); // Removed .select().single()
      if (insertError) {
        console.error("Error inserting initial game state for joined room:", insertError);
      }
      // No setGameState here, rely on subscription
    }

    // Fetch initial room users for the joined room
    const { data: initialRoomUsers, error: fetchRoomUsersError } = await supabase
      .from('room_users')
      .select('*')
      .eq('room_id', roomData.id); // Use roomData.id (UUID)

    if (fetchRoomUsersError) {
      console.error("Error fetching initial room users:", fetchRoomUsersError);
      toast.error("Ошибка при получении списка пользователей комнаты.");
    } else if (initialRoomUsers) {
      setRegisteredUsers(initialRoomUsers as RegisteredUser[]);
    }
  };

  const handleRegister = async () => {
    if (!nickname.trim()) {
      toast.error("Пожалуйста, введите никнейм.");
      return;
    }
    if (!selectedRole) {
      toast.error("Пожалуйста, выберите роль.");
      return;
    }
    if (!roomId) {
      toast.error("Сначала присоединитесь или создайте комнату.");
      return;
    }

    const { data: existingUsers, error: fetchError } = await supabase
      .from('room_users')
      .select('id')
      .eq('room_id', roomId)
      .eq('nickname', nickname.trim());

    if (fetchError) {
      console.error("Error checking nickname uniqueness:", fetchError);
      toast.error("Ошибка при проверке никнейма.");
      return;
    }

    if (existingUsers && existingUsers.length > 0) {
      toast.error("Этот никнейм уже используется в этой комнате.");
      return;
    }

    let newUser: Omit<RegisteredUser, 'id'> & { room_id: string, user_id: string } = {
      room_id: roomId,
      user_id: uuidv4(),
      nickname: nickname.trim(),
      role: selectedRole,
    };

    if (selectedRole === 'captain') {
      if (!selectedTeam) {
        toast.error("Пожалуйста, выберите команду.");
        return;
      }
      if (registeredCaptains[selectedTeam]) {
        toast.error(`Капитан для ${selectedTeam} уже зарегистрирован.`);
        return;
      }
      newUser.team = selectedTeam;
    }

    const { data, error } = await supabase
      .from('room_users')
      .insert([newUser])
      .select();

    if (error) {
      console.error("Error registering user:", error);
      toast.error("Ошибка при регистрации пользователя.");
      return;
    }

    if (data && data.length > 0) {
      setCurrentUserId(data[0].id);
      setIsUserRegistered(true);
      toast.success(`Вы зарегистрированы как ${selectedRole === 'captain' ? `капитан ${selectedTeam}` : 'зритель'}: ${nickname}`);
    }
  };

  // Subscribe to room_users changes
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room_users_room_${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_users', filter: `room_id=eq.${roomId}` }, payload => {
        console.log('Room users change received!', payload);
        supabase
          .from('room_users')
          .select('*')
          .eq('room_id', roomId)
          .then(({ data, error }) => {
            if (error) {
              console.error("Error fetching room users on change:", error);
              return;
            }
            if (data && data.length > 0) {
              setRegisteredUsers(data as RegisteredUser[]);
            }
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Subscribe to game_states changes
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`game_states_room_${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_states', filter: `room_id=eq.${roomId}` }, payload => {
        console.log('Game state change received!', payload);
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const newGameState = payload.new as GameState;
          console.log("Realtime: Setting game state directly from payload:", newGameState);
          setGameState(newGameState);
        } else if (payload.eventType === 'DELETE') {
          console.log("Realtime: Game state deleted. Resetting.");
          setGameState(null); 
        } else {
          // Fallback to re-fetch if eventType is not handled directly (e.g., initial LOAD)
          supabase
            .from('game_states')
            .select('*')
            .eq('room_id', roomId)
            .then(({ data, error }) => {
              if (error) {
                console.error("Error fetching game state on change:", error);
                return;
              }
              if (data && data.length > 0) {
                console.log("Realtime (fallback): Setting game state to:", data[0]);
                setGameState(data[0] as GameState);
              } else {
                console.log("Realtime (fallback): No game state data received for room:", roomId);
              }
            });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Initial fetch of game state and room users when roomId is set (after join/create)
  useEffect(() => {
    const fetchInitialRoomData = async () => {
      if (!roomId) return;

      // Fetch initial game state
      const { data: initialGameState, error: fetchGameStateError } = await supabase
        .from('game_states')
        .select('*')
        .eq('room_id', roomId);

      if (fetchGameStateError && fetchGameStateError.code !== 'PGRST116') {
        console.error("Error fetching initial game state:", fetchGameStateError);
        toast.error("Ошибка при получении состояния игры.");
      } else if (initialGameState && initialGameState.length > 0) {
        setGameState(initialGameState[0] as GameState);
      } else {
        // If no game state exists, create a default one (should ideally be created with room)
        const { error: insertError } = await supabase
          .from('game_states')
          .insert({
            id: roomId,
            room_id: roomId,
            game_started: false,
            timer_start_time: new Date().toISOString(),
            game_log: [`Комната создана. Ожидание начала игры.`]
          });
        if (insertError) {
          console.error("Error inserting initial game state:", insertError);
        } else {
          console.log("Initial game state inserted. Waiting for Realtime update.");
        }
      }

      // Fetch initial room users
      const { data: initialRoomUsers, error: fetchRoomUsersError } = await supabase
        .from('room_users')
        .select('*')
        .eq('room_id', roomId);

      if (fetchRoomUsersError) {
        console.error("Error fetching initial room users:", fetchRoomUsersError);
        toast.error("Ошибка при получении списка пользователей комнаты.");
      } else if (initialRoomUsers) {
        setRegisteredUsers(initialRoomUsers as RegisteredUser[]);
      }
    };

    fetchInitialRoomData();
  }, [roomId]); // This effect runs when roomId changes

  // Timer effect
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (gameStarted && !gameEnded && currentTurn && gameState) {
      const startTime = new Date(gameState.timer_start_time).getTime();
      const duration = getTimerDuration(currentTurnIndex) * 1000; // in milliseconds
      const endTime = startTime + duration;

      const updateLocalTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setLocalTimer(remaining);

        if (remaining <= 0) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          handleTimerExpiryOrRandomPick();
        }
      };

      updateLocalTimer(); // Set initial timer value
      timerIntervalRef.current = setInterval(updateLocalTimer, 1000);
    } else if (gameEnded && gameStarted) {
      setShowTeamCompositionDialog(true);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [gameStarted, gameEnded, currentTurn, currentTurnIndex, gameState, handleTimerExpiryOrRandomPick]);


  const team1BanLimitDisplay = useMemo(() => currentModeConfig.pickBanOrder.filter(turn => turn.type === 'ban' && turn.team === 'Team 1').length, [currentModeConfig]);
  const team2BanLimitDisplay = useMemo(() => currentModeConfig.pickBanOrder.filter(turn => turn.type === 'ban' && turn.team === 'Team 2').length, [currentModeConfig]);

  const timerProgress = useMemo(() => {
    const duration = getTimerDuration(currentTurnIndex);
    return (localTimer / duration) * 100;
  }, [localTimer, currentTurnIndex]);

  const renderEmptySlots = (count: number, type: 'pick' | 'ban') => {
    const Icon = type === 'ban' ? XCircle : PlusCircle;
    return Array.from({ length: count }).map((_, i) => (
      <Badge key={`empty-${type}-${i}`} variant="secondary" className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1 pr-2 h-8 w-24">
        <Icon className="h-4 w-4" />
        {type === 'pick' ? 'Выбор' : 'Бан'}
      </Badge>
    ));
  };

  const copyToClipboard = (text: string, message: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        toast.success(message);
      }).catch(err => {
        console.error('Failed to copy using clipboard API: ', err);
        toast.error("Не удалось скопировать.");
      });
    } else {
      // Fallback for environments where navigator.clipboard is not available
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success(message);
      } catch (err) {
        console.error('Fallback copy failed: ', err);
        toast.error("Не удалось скопировать. Ваш браузер не поддерживает автоматическое копирование.");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-700 p-4">
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 text-gray-100">Капитан Тидус</h1>
        <p className="text-xl text-gray-300">
          {gameStarted ? (isUserRegistered ? currentModeConfig.name : "Псевдорегистрация") : "Выберите режим игры"}
        </p>
      </div>

      <div className="w-full max-w-4xl bg-card rounded-lg shadow-lg p-6 mb-8">
        {!isRoomJoined ? (
          // 1. Create or Join Room section
          <div className="flex flex-col items-center justify-center gap-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Создать или присоединиться к комнате</h2>
            <div className="w-full max-w-xs space-y-4">
              <div>
                <Label htmlFor="room-name-input" className="mb-2 block text-left">Название новой комнаты</Label>
                <Input
                  id="room-name-input"
                  placeholder="Введите название комнаты"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
                <Button onClick={handleCreateRoom} className="w-full bg-green-600 hover:bg-green-700 text-white mt-2">
                  Создать комнату
                </Button>
              </div>
              <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                <span className="flex-shrink mx-4 text-gray-500 dark:text-gray-400">ИЛИ</span>
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div>
                <Label htmlFor="room-id-input" className="mb-2 block text-left">ID или код существующей комнаты</Label>
                <Input
                  id="room-id-input"
                  placeholder="Введите ID или код комнаты"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                />
                <Button onClick={handleJoinRoom} className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2">
                  Присоединиться к комнате
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // User is in a room (isRoomJoined is true)
          <div> {/* Added this wrapper div to ensure a single parent element */}
            {!isUserRegistered ? (
              // 2. Registration section (nickname, role, team)
              <div className="flex flex-col items-center justify-center gap-6">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Регистрация в комнате: {roomName}</h2>
                <div className="w-full max-w-xs">
                  <Label htmlFor="nickname-input" className="mb-2 block text-left">Никнейм</Label>
                  <Input
                    id="nickname-input"
                    placeholder="Введите ваш никнейм"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="mb-4"
                  />
                  <Label htmlFor="role-select" className="mb-2 block text-left">Выберите роль</Label>
                  <Select value={selectedRole} onValueChange={(value: 'captain' | 'spectator') => setSelectedRole(value)}>
                    <SelectTrigger id="role-select" className="w-full mb-4">
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="captain">Капитан</SelectItem>
                      <SelectItem value="spectator">Зритель</SelectItem>
                    </SelectContent>
                  </Select>

                  {selectedRole === 'captain' && (
                    <>
                      <Label htmlFor="team-select" className="mb-2 block text-left">Выберите команду</Label>
                      <Select value={selectedTeam} onValueChange={(value: 'Team 1' | 'Team 2') => setSelectedTeam(value)}>
                        <SelectTrigger id="team-select" className="w-full mb-4">
                          <SelectValue placeholder="Выберите команду" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Team 1" disabled={registeredCaptains['Team 1']}>Команда 1 {registeredCaptains['Team 1'] && '(Занято)'}</SelectItem>
                          <SelectItem value="Team 2" disabled={registeredCaptains['Team 2']}>Команда 2 {registeredCaptains['Team 2'] && '(Занято)'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <Button onClick={handleRegister} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white shadow-lg hover:shadow-xl">
                    Зарегистрироваться
                  </Button>
                </div>
              </div>
            ) : (
              // User is registered in a room (isUserRegistered is true)
              !gameStarted ? (
                // 3. Game setup section (select mode, start game)
                <div className="flex flex-col items-center justify-center gap-6">
                  <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Комната: {roomName}</h2>
                  {roomShortCode && (
                    <div className="flex items-center gap-2 text-lg text-gray-700 dark:text-gray-300">
                      Код комнаты: <span className="font-bold text-primary">{roomShortCode}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(roomShortCode, "Код комнаты скопирован!")}
                        className="h-8 w-8"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <label htmlFor="game-mode-select" className="text-lg font-semibold text-gray-800 dark:text-gray-200">Выберите режим игры:</label>
                  <Select value={selectedModeKey} onValueChange={(value) => setSelectedModeKey(value)}>
                    <SelectTrigger id="game-mode-select" className="w-[200px]">
                      <SelectValue placeholder="Выберите режим" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(gameModes).map(([key, mode]) => (
                        <SelectItem key={key} value={key}>
                          {mode.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleStartGame} className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-4 mt-4">
                    Начать игру
                  </Button>
                  <Card className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                    <CardHeader className="p-0 pb-2">
                      <CardTitle className="text-xl font-bold text-center text-gray-800 dark:text-gray-200">Как играть?</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 text-gray-700 dark:text-gray-300 text-sm text-left">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Выберите режим игры (2x2 или 3x3).</li>
                        <li>Нажмите "Начать игру".</li>
                        <li>Зарегистрируйтесь как "Капитан" или "Зритель".</li>
                        <li>Капитаны по очереди банят и выбирают персонажей.</li>
                        <li>Если время хода истекает, персонаж выбирается автоматически.</li>
                        <li>Следите за историей драфта и составами команд в панелях.</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                // Game is started (gameStarted is true)
                gameEnded ? (
                  // 5. Game ended screen
                  <div className="text-center">
                    <h2 className="text-3xl font-semibold text-green-600 dark:text-green-400 mb-4">Игра завершена!</h2>
                    <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">Все персонажи выбраны и забанены.</p>
                    <Button onClick={resetGame} className="bg-blue-600 hover:bg-blue-700 text-white">Начать заново</Button>
                  </div>
                ) : (
                  // 4. Main game UI
                  <>
                    <div className="mb-6 text-center">
                      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                        Текущий ход: <span className={`font-bold ${currentTurn?.team === selectedTeam && selectedRole === 'captain' ? 'text-red-500 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>{currentTurn?.team}</span> - <span className="text-purple-600 dark:text-purple-400">{currentTurn?.type === 'ban' ? 'Бан' : 'Выбор'}</span>
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Ход {currentTurnIndex + 1} из {currentModeConfig.pickBanOrder.length}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`text-5xl font-bold text-red-500 dark:text-red-400 mt-4 ${localTimer <= 5 ? 'animate-pulse' : ''}`}>
                            {localTimer}s
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Время до конца хода</p>
                        </TooltipContent>
                      </Tooltip>
                      <Progress value={timerProgress} className="w-full mt-2 h-2" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <Card className="bg-secondary border-l-4 border-green-500">
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Команда 1: Выбрано ({team1Picks.length}/{currentModeConfig.teamPickLimit})</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2 min-h-[40px]">
                          {team1Picks.map(char => (
                            <Badge key={char.id} variant="default" className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-1 pr-2">
                              <img src={char.image} alt={char.name} className="w-6 h-6 object-cover rounded-full" />
                              {char.name}
                            </Badge>
                          ))}
                          {renderEmptySlots(currentModeConfig.teamPickLimit - team1Picks.length, 'pick')}
                        </CardContent>
                      </Card>

                      <Card className="bg-secondary border-l-4 border-blue-500">
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Команда 2: Выбрано ({team2Picks.length}/{currentModeConfig.teamPickLimit})</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2 min-h-[40px]">
                          {team2Picks.map(char => (
                            <Badge key={char.id} variant="default" className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-1 pr-2">
                              <img src={char.image} alt={char.name} className="w-6 h-6 object-cover rounded-full" />
                              {char.name}
                            </Badge>
                          ))}
                          {renderEmptySlots(currentModeConfig.teamPickLimit - team2Picks.length, 'pick')}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <Card className="bg-secondary border-l-4 border-green-500">
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Команда 1: Забанено ({team1Bans.length}/{team1BanLimitDisplay})</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2 min-h-[40px]">
                          {team1Bans.map(char => (
                            <Badge key={char.id} variant="destructive" className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-1 pr-2">
                              <img src={char.image} alt={char.name} className="w-6 h-6 object-cover rounded-full" />
                              {char.name}
                            </Badge>
                          ))}
                          {renderEmptySlots(team1BanLimitDisplay - team1Bans.length, 'ban')}
                        </CardContent>
                      </Card>

                      <Card className="bg-secondary border-l-4 border-blue-500">
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Команда 2: Забанено ({team2Bans.length}/{team2BanLimitDisplay})</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2 min-h-[40px]">
                          {team2Bans.map(char => (
                            <Badge key={char.id} variant="destructive" className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-1 pr-2">
                              <img src={char.image} alt={char.name} className="w-6 h-6 object-cover rounded-full" />
                              {char.name}
                            </Badge>
                          ))}
                          {renderEmptySlots(team2BanLimitDisplay - team2Bans.length, 'ban')}
                        </CardContent>
                      </Card>
                    </div>

                    <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Доступные персонажи</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                      {availableCharacters.map(char => (
                        <Tooltip key={char.id}>
                          <TooltipTrigger asChild>
                            <Card
                              className={`
                                cursor-pointer transition-all duration-200 transform
                                ${canPerformAction ? 'hover:shadow-lg hover:border-primary hover:scale-105' : 'opacity-50 cursor-not-allowed'}
                                bg-card border-2 border-transparent
                              `}
                              onClick={() => handleManualCharacterSelection(char)}
                            >
                              <CardContent className="flex flex-col items-center p-4">
                                <img src={char.image} alt={char.name} className="w-16 h-16 object-cover rounded-full mb-2 border-2 border-gray-300 dark:border-gray-600" />
                                <p className="text-md font-medium text-gray-900 dark:text-gray-100 text-center">{char.name}</p>
                              </CardContent>
                            </Card>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{char.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    <div className="mt-6 flex justify-center gap-4">
                      <Button
                        onClick={handleTimerExpiryOrRandomPick}
                        disabled={!canPerformAction || availableCharacters.length === 0}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        Выбрать случайного персонажа
                      </Button>
                      <Button onClick={resetGame} variant="outline" className="text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700">
                        Сбросить игру
                      </Button>
                    </div>
                  </>
                )
              )
            )}
          </div> 
        )}
      </div>
      <MadeWithDyad />

      <TeamCompositionDialog
        isOpen={showTeamCompositionDialog}
        onClose={() => setShowTeamCompositionDialog(false)}
        team1Picks={team1Picks}
        team2Picks={team2Picks}
      />

      {isRoomJoined && (
        <RoomStatePanel
          registeredUsers={registeredUsers}
          roomId={roomId}
          roomShortCode={roomShortCode}
        />
      )}

      {gameStarted && isUserRegistered && (
        <GameLogPanel gameLog={gameLog} />
      )}

      {isRoomJoined && isUserRegistered && (
        <ChatPanel
          currentUserNickname={nickname}
          currentUserRole={selectedRole}
          currentUserTeam={selectedTeam}
          roomId={roomId}
        />
      )}
    </div>
  );
};

export default Index;