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
import { XCircle, PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

const Index = () => {
  const [isUserRegistered, setIsUserRegistered] = useState(false);
  const [nickname, setNickname] = useState('');
  const [selectedRole, setSelectedRole] = useState<'captain' | 'spectator' | ''>('');
  const [selectedTeam, setSelectedTeam] = useState<'Team 1' | 'Team 2' | ''>('');
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [isRoomJoined, setIsRoomJoined] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // Local user ID for room_users table

  const registeredCaptains = useMemo(() => ({
    'Team 1': registeredUsers.some(u => u.role === 'captain' && u.team === 'Team 1'),
    'Team 2': registeredUsers.some(u => u.role === 'captain' && u.team === 'Team 2'),
  }), [registeredUsers]);

  const [selectedModeKey, setSelectedModeKey] = useState<string>('3v3');
  const [gameStarted, setGameStarted] = useState(false);
  const currentModeConfig = useMemo(() => gameModes[selectedModeKey], [selectedModeKey]);

  const [team1Bans, setTeam1Bans] = useState<Character[]>([]);
  const [team2Bans, setTeam2Bans] = useState<Character[]>([]);
  const [team1Picks, setTeam1Picks] = useState<Character[]>([]);
  const [team2Picks, setTeam2Picks] = useState<Character[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showTeamCompositionDialog, setShowTeamCompositionDialog] = useState(false);
  const [gameLog, setGameLog] = useState<string[]>([]);

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

  const availableCharacters = useMemo(() => {
    const allSelectedIds = new Set([
      ...team1Bans.map(c => c.id),
      ...team2Bans.map(c => c.id),
      ...team1Picks.map(c => c.id),
      ...team2Picks.map(c => c.id),
    ]);
    return CHARACTERS.filter(char => !allSelectedIds.has(char.id));
  }, [team1Bans, team2Bans, team1Picks, team2Picks]);

  const gameEnded = currentTurnIndex >= currentModeConfig.pickBanOrder.length;

  const canPerformAction = useMemo(() => {
    if (!gameStarted || gameEnded || !currentTurn) return false;
    if (selectedRole === 'spectator') return false;
    if (selectedRole === 'captain' && currentTurn.team === selectedTeam) return true;
    return false;
  }, [gameStarted, gameEnded, currentTurn, selectedRole, selectedTeam]);

  const handleCharacterAction = useCallback((character: Character, isRandom: boolean = false): boolean => {
    if (!currentTurn) {
      if (!isRandom) toast.info("Игра завершена!");
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

    let logMessage = '';
    let actionSuccessful = false;

    if (currentTurn.type === 'ban') {
      if (currentTurn.team === 'Team 1') {
        if (team1Bans.length >= team1BanLimit) {
          if (!isRandom) toast.error(`Команда 1 уже забанила ${team1BanLimit} персонажей.`);
          return false;
        }
        setTeam1Bans(prev => [...prev, character]);
        logMessage = `${currentTurn.team} ${isRandom ? 'автоматически забанил' : 'забанил'} ${character.name}.`;
        actionSuccessful = true;
      } else {
        if (team2Bans.length >= team2BanLimit) {
          if (!isRandom) toast.error(`Команда 2 уже забанила ${team2BanLimit} персонажей.`);
          return false;
        }
        setTeam2Bans(prev => [...prev, character]);
        logMessage = `${currentTurn.team} ${isRandom ? 'автоматически забанил' : 'забанил'} ${character.name}.`;
        actionSuccessful = true;
      }
    } else {
      if (currentTurn.team === 'Team 1') {
        if (team1Picks.length >= currentModeConfig.teamPickLimit) {
          if (!isRandom) toast.error(`Команда 1 уже выбрала ${currentModeConfig.teamPickLimit} персонажей.`);
          return false;
        }
        setTeam1Picks(prev => [...prev, character]);
        logMessage = `${currentTurn.team} ${isRandom ? 'автоматически выбрал' : 'выбрал'} ${character.name}.`;
        actionSuccessful = true;
      } else {
        if (team2Picks.length >= currentModeConfig.teamPickLimit) {
          if (!isRandom) toast.error(`Команда 2 уже выбрала ${currentModeConfig.teamPickLimit} персонажей.`);
          return false;
        }
        setTeam2Picks(prev => [...prev, character]);
        logMessage = `${currentTurn.team} ${isRandom ? 'автоматически выбрал' : 'выбрал'} ${character.name}.`;
        actionSuccessful = true;
      }
    }
    if (actionSuccessful) {
      toast.success(logMessage);
      setGameLog(prev => [...prev, logMessage]);
    }
    return actionSuccessful;
  }, [currentTurn, team1Bans, team2Bans, team1Picks, team2Picks, currentModeConfig.pickBanOrder, currentModeConfig.teamPickLimit]);

  const handleManualCharacterSelection = useCallback((character: Character) => {
    if (canPerformAction) {
      if (handleCharacterAction(character, false)) {
        setCurrentTurnIndex(prev => prev + 1);
      }
    } else {
      toast.error("Вы не можете совершить это действие сейчас.");
    }
  }, [canPerformAction, handleCharacterAction]);

  const handleTimerExpiryOrRandomPick = useCallback(() => {
    if (!currentTurn) {
      toast.info("Игра завершена!");
      setCurrentTurnIndex(prev => prev + 1);
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
    } else {
      const randomIndex = Math.floor(Math.random() * availableCharacters.length);
      const randomCharacter = availableCharacters[randomIndex];
      handleCharacterAction(randomCharacter, true); // Always attempt the automatic action
    }
    setCurrentTurnIndex(prev => prev + 1); // Always move to the next turn after timer expiry
  }, [currentTurn, availableCharacters, selectedRole, selectedTeam, handleCharacterAction]);


  const resetGame = useCallback(async () => {
    setTeam1Bans([]);
    setTeam2Bans([]);
    setTeam1Picks([]);
    setTeam2Picks([]);
    setCurrentTurnIndex(0);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimer(0);
    setGameStarted(false);
    setShowTeamCompositionDialog(false);
    setIsUserRegistered(false);
    setNickname('');
    setSelectedRole('');
    setSelectedTeam('');
    setRegisteredUsers([]);
    setGameLog([]);
    setRoomId(null);
    setRoomName('');
    setIsRoomJoined(false);
    setCurrentUserId(null);

    // Optionally delete room_users entries for this room if it's a "reset" for the room owner
    if (roomId) {
      const { error } = await supabase
        .from('room_users')
        .delete()
        .eq('room_id', roomId);
      if (error) {
        console.error("Error deleting room users on reset:", error);
        toast.error("Ошибка при сбросе пользователей комнаты.");
      }
    }

    toast.info("Игра и регистрация сброшены.");
  }, [roomId]);

  const handleStartGame = () => {
    setGameStarted(true);
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast.error("Пожалуйста, введите название комнаты.");
      return;
    }
    const { data, error } = await supabase
      .from('rooms')
      .insert([{ name: roomName.trim() }])
      .select();

    if (error) {
      console.error("Error creating room:", error);
      toast.error("Ошибка при создании комнаты.");
      return;
    }
    if (data && data.length > 0) {
      setRoomId(data[0].id);
      setIsRoomJoined(true);
      toast.success(`Комната "${roomName}" создана! ID: ${data[0].id}`);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId || !roomId.trim()) {
      toast.error("Пожалуйста, введите ID комнаты.");
      return;
    }
    const { data, error } = await supabase
      .from('rooms')
      .select('name')
      .eq('id', roomId.trim())
      .single();

    if (error || !data) {
      console.error("Error joining room:", error);
      toast.error("Комната с таким ID не найдена.");
      return;
    }
    setRoomName(data.name);
    setIsRoomJoined(true);
    toast.success(`Вы присоединились к комнате "${data.name}".`);
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

    // Check for unique nickname in the current room
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
      user_id: crypto.randomUUID(), // Generate a local unique ID for this user session
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
      setCurrentUserId(data[0].id); // Store the ID from the database for this user's entry
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
        console.log('Change received!', payload);
        // Re-fetch all users for simplicity, or handle specific events (INSERT, UPDATE, DELETE)
        supabase
          .from('room_users')
          .select('*')
          .eq('room_id', roomId)
          .then(({ data, error }) => {
            if (error) {
              console.error("Error fetching room users:", error);
              return;
            }
            if (data) {
              setRegisteredUsers(data as RegisteredUser[]);
            }
          });
      })
      .subscribe();

    // Initial fetch
    supabase
      .from('room_users')
      .select('*')
      .eq('room_id', roomId)
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching initial room users:", error);
          return;
        }
        if (data) {
          setRegisteredUsers(data as RegisteredUser[]);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);


  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (gameStarted && !gameEnded && currentTurn) {
      setTimer(getTimerDuration(currentTurnIndex));
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            toast.warning(`Время для ${currentTurn.team} истекло! Выбирается случайный персонаж.`);
            handleTimerExpiryOrRandomPick();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (gameEnded && gameStarted) {
      setShowTeamCompositionDialog(true);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [gameStarted, gameEnded, currentTurn, currentTurnIndex, handleTimerExpiryOrRandomPick]);

  const team1BanLimitDisplay = useMemo(() => currentModeConfig.pickBanOrder.filter(turn => turn.type === 'ban' && turn.team === 'Team 1').length, [currentModeConfig]);
  const team2BanLimitDisplay = useMemo(() => currentModeConfig.pickBanOrder.filter(turn => turn.type === 'ban' && turn.team === 'Team 2').length, [currentModeConfig]);

  const timerProgress = useMemo(() => {
    const duration = getTimerDuration(currentTurnIndex);
    return (timer / duration) * 100;
  }, [timer, currentTurnIndex]);

  const renderEmptySlots = (count: number, type: 'pick' | 'ban') => {
    const Icon = type === 'ban' ? XCircle : PlusCircle;
    return Array.from({ length: count }).map((_, i) => (
      <Badge key={`empty-${type}-${i}`} variant="secondary" className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1 pr-2 h-8 w-24">
        <Icon className="h-4 w-4" />
        {type === 'pick' ? 'Выбор' : 'Бан'}
      </Badge>
    ));
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
                <Label htmlFor="room-id-input" className="mb-2 block text-left">ID существующей комнаты</Label>
                <Input
                  id="room-id-input"
                  placeholder="Введите ID комнаты"
                  value={roomId || ''}
                  onChange={(e) => setRoomId(e.target.value)}
                />
                <Button onClick={handleJoinRoom} className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2">
                  Присоединиться к комнате
                </Button>
              </div>
            </div>
          </div>
        ) : (
          !gameStarted ? (
            <div className="flex flex-col items-center justify-center gap-6">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Комната: {roomName} (ID: {roomId})</h2>
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
            !isUserRegistered ? (
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
              gameEnded ? (
                <div className="text-center">
                  <h2 className="text-3xl font-semibold text-green-600 dark:text-green-400 mb-4">Игра завершена!</h2>
                  <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">Все персонажи выбраны и забанены.</p>
                  <Button onClick={resetGame} className="bg-blue-600 hover:bg-blue-700 text-white">Начать заново</Button>
                </div>
              ) : (
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
                        <div className={`text-5xl font-bold text-red-500 dark:text-red-400 mt-4 ${timer <= 5 ? 'animate-pulse' : ''}`}>
                          {timer}s
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
          )
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
        />
      )}

      {gameStarted && isUserRegistered && (
        <GameLogPanel gameLog={gameLog} />
      )}

      {gameStarted && isUserRegistered && (
        <ChatPanel
          currentUserNickname={nickname}
          currentUserRole={selectedRole}
          currentUserTeam={selectedTeam}
        />
      )}
    </div>
  );
};

export default Index;