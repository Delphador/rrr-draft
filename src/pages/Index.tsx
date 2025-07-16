import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { CHARACTERS, Character } from "@/data/characters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type TurnAction = 'ban' | 'pick';
type Team = 'Team 1' | 'Team 2';

interface Turn {
  type: TurnAction;
  team: Team;
}

const pickBanOrder: Turn[] = [
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
];

const Index = () => {
  const [bannedCharacters, setBannedCharacters] = useState<Character[]>([]);
  const [team1Picks, setTeam1Picks] = useState<Character[]>([]);
  const [team2Picks, setTeam2Picks] = useState<Character[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentTurn = useMemo<Turn | null>(() => {
    if (currentTurnIndex < pickBanOrder.length) {
      return pickBanOrder[currentTurnIndex];
    }
    return null;
  }, [currentTurnIndex]);

  const getTimerDuration = (turnIndex: number) => {
    if (turnIndex === 0 || turnIndex === 1) { // Первые два бана
      return 60;
    }
    return 30; // Остальные пики и баны
  };

  const availableCharacters = useMemo(() => {
    const allSelectedIds = new Set([
      ...bannedCharacters.map(c => c.id),
      ...team1Picks.map(c => c.id),
      ...team2Picks.map(c => c.id),
    ]);
    return CHARACTERS.filter(char => !allSelectedIds.has(char.id));
  }, [bannedCharacters, team1Picks, team2Picks]);

  const gameEnded = currentTurnIndex >= pickBanOrder.length;

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

    const randomIndex = Math.floor(Math.random() * availableCharacters.length);
    const randomCharacter = availableCharacters[randomIndex];
    handleCharacterAction(randomCharacter, true);
  };

  const handleCharacterAction = (character: Character, isRandom: boolean = false) => {
    if (!currentTurn) {
      if (!isRandom) toast.info("Игра завершена!");
      return;
    }

    const isAlreadySelected = bannedCharacters.some(c => c.id === character.id) ||
                              team1Picks.some(c => c.id === character.id) ||
                              team2Picks.some(c => c.id === character.id);

    if (isAlreadySelected) {
      if (!isRandom) toast.error("Этот персонаж уже выбран или забанен.");
      return;
    }

    if (currentTurn.type === 'ban') {
      setBannedCharacters(prev => [...prev, character]);
      toast.success(`${currentTurn.team} ${isRandom ? 'автоматически забанил' : 'забанил'} ${character.name}.`);
    } else { // type === 'pick'
      if (currentTurn.team === 'Team 1') {
        if (team1Picks.length >= 3) {
          if (!isRandom) toast.error("Команда 1 уже выбрала 3 персонажей.");
          return;
        }
        setTeam1Picks(prev => [...prev, character]);
        toast.success(`${currentTurn.team} ${isRandom ? 'автоматически выбрал' : 'выбрал'} ${character.name}.`);
      } else { // Team 2
        if (team2Picks.length >= 3) {
          if (!isRandom) toast.error("Команда 2 уже выбрала 3 персонажей.");
          return;
        }
        setTeam2Picks(prev => [...prev, character]);
        toast.success(`${currentTurn.team} ${isRandom ? 'автоматически выбрал' : 'выбрал'} ${character.name}.`);
      }
    }
    setCurrentTurnIndex(prev => prev + 1);
    setIsTimerActive(false); // Останавливаем таймер до следующего хода
  };

  const resetGame = () => {
    setBannedCharacters([]);
    setTeam1Picks([]);
    setTeam2Picks([]);
    setCurrentTurnIndex(0);
    setIsTimerActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setTimer(0);
    toast.info("Игра сброшена.");
  };

  // Effect для управления таймером
  useEffect(() => {
    if (gameEnded) {
      setIsTimerActive(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
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
  }, [currentTurn, isTimerActive, timer, gameEnded, currentTurnIndex]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">Rock n Roll Racing: Captain's Mode</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          3v3 PvP Character Selection
        </p>
      </div>

      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        {gameEnded ? (
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
                Ход {currentTurnIndex + 1} из {pickBanOrder.length}
              </p>
              <div className="text-5xl font-bold text-red-500 dark:text-red-400 mt-4">
                {timer}s
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="bg-gray-50 dark:bg-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Команда 1: Выбрано ({team1Picks.length}/3)</CardTitle>
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
                  <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Команда 2: Выбрано ({team2Picks.length}/3)</CardTitle>
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

            <Card className="mb-8 bg-gray-50 dark:bg-gray-700">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">Забаненные персонажи ({bannedCharacters.length}/6)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {bannedCharacters.length > 0 ? (
                  bannedCharacters.map(char => (
                    <Badge key={char.id} variant="destructive" className="bg-red-500 hover:bg-red-600 text-white">
                      {char.name}
                    </Badge>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">Пока нет забаненных персонажей</p>
                )}
              </CardContent>
            </Card>

            <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Доступные персонажи</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {availableCharacters.map(char => (
                <Card
                  key={char.id}
                  className="cursor-pointer hover:shadow-md transition-shadow duration-200 bg-white dark:bg-gray-700"
                  onClick={() => handleCharacterAction(char)}
                >
                  <CardContent className="flex flex-col items-center p-4">
                    <img src={char.image} alt={char.name} className="w-16 h-16 object-cover rounded-full mb-2 border-2 border-gray-300 dark:border-gray-600" />
                    <p className="text-md font-medium text-gray-900 dark:text-gray-100 text-center">{char.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <Button onClick={handleRandomCharacterSelection} disabled={!currentTurn || availableCharacters.length === 0} className="bg-yellow-600 hover:bg-yellow-700 text-white">
                Выбрать случайного персонажа
              </Button>
              <Button onClick={resetGame} variant="outline" className="text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700">
                Сбросить игру
              </Button>
            </div>
          </>
        )}
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;