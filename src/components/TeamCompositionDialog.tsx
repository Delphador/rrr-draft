"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Character } from "@/data/characters";
import { Badge } from "@/components/ui/badge";

interface TeamCompositionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  team1Picks: Character[];
  team2Picks: Character[];
}

const TeamCompositionDialog: React.FC<TeamCompositionDialogProps> = ({
  isOpen,
  onClose,
  team1Picks,
  team2Picks,
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md md:max-w-lg lg:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-bold text-center">Составы команд</AlertDialogTitle>
          <AlertDialogDescription className="text-center text-gray-600 dark:text-gray-400">
            Драфт завершен! Вот финальные составы команд:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Команда 1</h3>
            <div className="flex flex-wrap gap-2">
              {team1Picks.length > 0 ? (
                team1Picks.map((char) => (
                  <Badge key={char.id} variant="default" className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-1 pr-2">
                    <img src={char.image} alt={char.name} className="w-6 h-6 object-cover rounded-full" />
                    {char.name}
                  </Badge>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Нет выбранных персонажей</p>
              )}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Команда 2</h3>
            <div className="flex flex-wrap gap-2">
              {team2Picks.length > 0 ? (
                team2Picks.map((char) => (
                  <Badge key={char.id} variant="default" className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-1 pr-2">
                    <img src={char.image} alt={char.name} className="w-6 h-6 object-cover rounded-full" />
                    {char.name}
                  </Badge>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Нет выбранных персонажей</p>
              )}
            </div>
          </div>
        </div>
        <AlertDialogFooter className="mt-6 flex justify-center">
          <AlertDialogAction onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white">
            Закрыть
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TeamCompositionDialog;