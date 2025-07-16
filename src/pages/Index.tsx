import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { ThemeToggle } from "@/components/ThemeToggle";

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
  totalBanLimit: number; // This will now represent the total bans across both teams
}

interface RegisteredUser {
  id: string;
  nickname: string;
  role: 'captain' | 'spectator';
  team?: 'Team 1' | 'Team 2';
}

const gameModes: Record<string, GameModeConfig> = {
  '3v3': {
    name: '3x3 PvP (Капитанский режим)',
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
    name: '2x2 PvP',
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

  const registeredCaptains = useMemo(() => ({
    'Team 1': registeredUsers.some(u => u.role === 'captain' && u.team === 'Team 1'),
    'Team 2': registeredUsers.some(u => u.role === 'captain' && u.team === 'Team 2'),
  }), [registeredUsers]);

  const [selectedModeKey, setSelectedModeKey] = useState<string>('3v3');
  const [gameStarted, setGameStarted] = useState(false);
  const currentModeConfig = useMemo(() => gameModes[selectedModeKey], [selectedModeKey]);

  const [team1Bans, setTeam1Bans] = useState<Character[]>([]); // New state for Team 1 bans
  const [team2Bans, setTeam2Bans] = useState<Character[]>([]); // New state for Team 2 bans
  const [team1Picks, setTeam1Picks] = useState<Character[]>([]);
  const [team2Picks, setTeam2Picks] = useState<Character[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
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

  const availableCharacters = useMemo(() => {
    const allSelectedIds = new Set([
      ...team1Bans.map(c => c.id), // Include Team 1 bans
      ...team2Bans.map(c => c.id), // Include Team 2 bans
      ...team1Picks.map(c => c.id),
      ...team2Picks.map(c => c.id),
    ]);
    return CHARACTERS.filter(char => !allSelectedIds.has(char.id));
  }, [team1Bans, team2Bans, team1Picks, team2Picks]); // Update dependencies

  const gameEnded = currentTurnIndex >= currentModeConfig.pickBanOrder.length;

  const resetTimer = (turnIndex: number) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setTimer(getTimerDuration(turnIndex));
    setIsTimerActive(true);
  };

  const handleRandomCharacterSelection = () => {
    if (!currentTurn || availableCharacters.length === 0) {
      toast.error("Нет доступных персонажей для случайного выбора.");
      return;
    }

    // Access control for random selection
    if (selectedRole === 'spectator') {
      toast.error("Зрители не могут делать выбор.");
      return;
    }
    if (selectedRole === 'captain' && currentTurn.team !== selectedTeam) {
      toast.error("Сейчас ход другой команды.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableCharacters.length);
    const randomCharacter = availableCharacters[randomIndex];
    handleCharacterAction(randomCharacter, true);
  };

  const handleCharacterAction = (character: Character, isRandom: boolean = false) => {
    if (!currentTurn) {
      if (!isRandom) toast.info("Игра завершена!");
      return;
    }

    // Access control for manual selection
    if (selectedRole === 'spectator') {
      if (!isRandom) toast.error("Зрители не могут делать выбор.");
      return;
    }
    if (selectedRole === 'captain' && currentTurn.team !== selectedTeam) {
      if (!isRandom) toast.error("Сейчас ход другой команды.");
      return;
    }

    const isAlreadySelected = team1Bans.some(c => c.id === character.id) ||
                              team2Bans.some(c => c.id === character.id) ||
                              team1Picks.some(c => c.id === character.id) ||
                              team2Picks.some(c => c.id === character.id);

    if (isAlreadySelected) {
      if (!isRandom) toast.error("Этот персонаж уже выбран или забанен.");
      return;
    }

    // Calculate team-specific ban limits based on pickBanOrder
    const team1BanLimit = currentModeConfig.pickBanOrder.filter(turn => turn.type === 'ban' && turn.team === 'Team 1').length;
    const team2BanLimit = currentModeConfig.pickBanOrder.filter(turn => turn.type === 'ban' && turn.team === 'Team 2').length;

    if (currentTurn.type === 'ban') {
      if (currentTurn.team === 'Team 1') {
        if (team1Bans.length >= team1BanLimit) {
          if (!isRandom) toast.error(`Команда 1 уже забанила ${team1BanLimit} персонажей.`);
          return;
        }
        setTeam1Bans(prev => [...prev, character]);
        toast.success(`${currentTurn.team} ${isRandom ? 'автоматически забанил' : 'забанил'} ${character.name}.`);
      } else { // Team 2
        if (team2Bans.length >= team2BanLimit) {
          if (!isRandom) toast.error(`Команда 2 уже забанила ${team2BanLimit} персонажей.`);
          return;
        }
        setTeam2Bans(prev => [...prev, character]);
        toast.success(`${currentTurn.team} ${isRandom ? 'автоматически забанил' : 'забанил'} ${character.name}.`);
      }
    } else { // type === 'pick'
      if (currentTurn.team === 'Team 1') {
        if (team1Picks.length >= currentModeConfig.teamPickLimit) {
          if (!isRandom) toast.error(`Команда 1 уже выбрала ${currentModeConfig.teamPickLimit} персонажей.`);
          return;
        }
        setTeam1Picks(prev => [...prev, character]);
        toast.success(`${currentTurn.team} ${isRandom ? 'автоматически выбрал' : 'выбрал'} ${character.name}.`);
      } else { // Team 2
        if (team2Picks.length >= currentModeConfig.teamPickLimit) {
          if (!isRandom) toast.error(`Команда 2 уже выбрала ${currentModeConfig.teamPickLimit} персонажей.`);
          return;
        }
        setTeam2Picks(prev => [...prev, character]);
        toast.success(`${currentTurn.team} ${isRandom ? 'автоматически выбрал' : 'выбрал'} ${character.name}.`);
      }
    }
    setCurrentTurnIndex(prev => prev + 1);
    setIsTimerActive(false);
  };

  const resetGame = () => {
    setTeam1Bans([]); // Reset Team 1 bans
    setTeam2Bans([]); // Reset Team 2 bans
    setTeam1Picks([]);
    setTeam2Picks([]);
    setCurrentTurnIndex(0);
    setIsTimerActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setTimer(0);
    setGameStarted(false);
    setShowTeamCompositionDialog(false);
    // Сброс состояния регистрации для полного перезапуска
    setIsUserRegistered(false);
    setNickname('');
    setSelectedRole('');
    setSelectedTeam('');
    setRegisteredUsers([]); // Очищаем список зарегистрированных пользователей
    toast.info("Игра и регистрация сброшены.");
  };

  const handleStartGame = () => {
    setGameStarted(true);
  };

  const handleRegister = () => {
    if (!nickname.trim()) {
      toast.error("Пожалуйста, введите никнейм.");
      return;
    }
    if (!selectedRole) {
      toast.error("Пожалуйста, выберите роль.");
      return;
    }

    const newUser: RegisteredUser = {
      id: Date.now().toString(), // Простой уникальный ID
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
      setRegisteredUsers(prev => [...prev, newUser]);
      toast.success(`Вы зарегистрированы как капитан ${selectedTeam}: ${nickname}`);
    } else { // spectator
      setRegisteredUsers(prev => [...prev, newUser]);
      toast.success(`Вы зарегистрированы как зритель: ${nickname}`);
    }
    setIsUserRegistered(true);
  };

  useEffect(() => {
    if (!gameStarted || gameEnded) {
      setIsTimerActive(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (gameEnded && gameStarted) {
        setShowTeamCompositionDialog(true);
      }
      return;
    }

    if (currentTurn && !isTimerActive) {
      resetTimer(currentTurnIndex);
    }

    if (isTimerActive && timer > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else if (timer === 0 && isTimerActive) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      toast.warning(`Время для ${currentTurn?.team} истекло! Выбирается случайный персонаж.`);
      handleRandomCharacterSelection();
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [currentTurn, isTimerActive, timer, gameEnded, currentTurnIndex, gameStarted]);

  useEffect(() => {
    if (isUserRegistered) {
      resetGame();
    }
  }, [selectedModeKey]);

  // Determine if the current user can perform an action
  const canPerformAction = useMemo(() => {
    if (!gameStarted || gameEnded || !currentTurn) return false;
    if (selectedRole === 'spectator') return false;
    if (selectedRole === 'captain' && currentTurn.team === selectedTeam) return true;
    return false;
  }, [gameStarted, gameEnded, currentTurn, selectedRole, selectedTeam]);

  // Calculate team-specific ban limits for display
  const team1BanLimitDisplay = useMemo(() => currentModeConfig.pickBanOrder.filter(turn => turn.type === 'ban' && turn.team === 'Team 1').length, [currentModeConfig]);
  const team2BanLimitDisplay = useMemo(() => currentModeConfig.pickBanOrder.filter(turn => turn.type === 'ban' && turn.team === 'Team 2').length, [currentModeConfig]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">Капитан Тидус</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          {gameStarted ? (isUserRegistered ? currentModeConfig.name : "Псевдорегистрация") : "Выберите режим игры"}
        </p>
      </div>

      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        {!gameStarted ? ( // First, choose game mode
          <div className="flex flex-col items-center justify-center gap-6">
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
            <Button onClick={handleStartGame} className="bg-blue-600 hover:bg-blue-700 text-white">
              Начать игру
            </Button>
          </div>
        ) : ( // Game started, now check registration
          !isUserRegistered ? ( // If not registered, show registration form
            <div className="flex flex-col items-center justify-center gap-6">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Регистрация</h2>
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
                <Button onClick={handleRegister} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Зарегистрироваться
                </Button>
              </div>
            </div>
          ) : ( // User is registered, show game UI or game ended message
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
                    Текущий ход: <span className="text-blue-600 dark:text-blue-400">{currentTurn?.team}</span> - <span className="text-purple-600 dark:text-purple-400">{currentTurn?.type === 'ban' ? 'Бан' : 'Выбор'}</span>
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ход {currentTurnIndex + 1} из {currentModeConfig.pickBanOrder.length}
                  </p>
                  <div className="text-5xl font-bold text-red-500 dark:text-red-400 mt-4">
                    {timer}s
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <Card className="bg-gray-50 dark:bg-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Команда 1: Выбрано ({team1Picks.length}/{currentModeConfig.teamPickLimit})</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {team1Picks.length > 0 ? (
                        team1Picks.map(char => (
                          <Badge key={char.id} variant="default" className="bg-green-500 hover:bg-green-600 text-white">
                            {char.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400">Пока нет выборов</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-50 dark:bg-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Команда 2: Выбрано ({team2Picks.length}/{currentModeConfig.teamPickLimit})</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {team2Picks.length > 0 ? (
                        team2Picks.map(char => (
                          <Badge key={char.id} variant="default" className="bg-blue-500 hover:bg-blue-600 text-white">
                            {char.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400">Пока нет выборов</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* New section for Banned Characters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <Card className="bg-gray-50 dark:bg-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Команда 1: Забанено ({team1Bans.length}/{team1BanLimitDisplay})</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {team1Bans.length > 0 ? (
                        team1Bans.map(char => (
                          <Badge key={char.id} variant="destructive" className="bg-red-500 hover:bg-red-600 text-white">
                            {char.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400">Пока нет забаненных персонажей</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-50 dark:bg-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Команда 2: Забанено ({team2Bans.length}/{team2BanLimitDisplay})</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {team2Bans.length > 0 ? (
                        team2Bans.map(char => (
                          <Badge key={char.id} variant="destructive" className="bg-red-500 hover:bg-red-600 text-white">
                            {char.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400">Пока нет забаненных персонажей</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Доступные персонажи</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {availableCharacters.map(char => (
                    <Card
                      key={char.id}
                      className={`
                        cursor-pointer transition-shadow duration-200
                        ${canPerformAction ? 'hover:shadow-md' : 'opacity-50 cursor-not-allowed'}
                        bg-white dark:bg-gray-700
                      `}
                      onClick={() => canPerformAction && handleCharacterAction(char)}
                    >
                      <CardContent className="flex flex-col items-center p-4">
                        <img src={char.image} alt={char.name} className="w-16 h-16 object-cover rounded-full mb-2 border-2 border-gray-300 dark:border-gray-600" />
                        <p className="text-md font-medium text-gray-900 dark:text-gray-100 text-center">{char.name}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="mt-6 flex justify-center gap-4">
                  <Button
                    onClick={handleRandomCharacterSelection}
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
      <MadeWithDyad />

      <TeamCompositionDialog
        isOpen={showTeamCompositionDialog}
        onClose={() => setShowTeamCompositionDialog(false)}
        team1Picks={team1Picks}
        team2Picks={team2Picks}
      />

      <RoomStatePanel
        registeredUsers={registeredUsers}
      />
    </div>
  );
};

export default Index;