"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RegisteredUser {
  id: string;
  nickname: string;
  role: 'captain' | 'spectator';
  team?: 'Team 1' | 'Team 2';
}

interface RoomStateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  registeredUsers: RegisteredUser[];
}

const RoomStateDialog: React.FC<RoomStateDialogProps> = ({
  isOpen,
  onClose,
  registeredUsers,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Состояние комнаты</DialogTitle>
          <DialogDescription className="text-center text-gray-600 dark:text-gray-400">
            Список зарегистрированных участников:
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
          {registeredUsers.length > 0 ? (
            registeredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md shadow-sm">
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{user.nickname}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Роль: {user.role === 'captain' ? 'Капитан' : 'Зритель'}
                    {user.team && ` | Команда: ${user.team}`}
                  </span>
                </div>
                <Badge variant={user.role === 'captain' ? "default" : "secondary"} className={user.role === 'captain' ? "bg-purple-500" : ""}>
                  {user.role === 'captain' ? 'Капитан' : 'Зритель'}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400">Пока нет зарегистрированных пользователей.</p>
          )}
        </div>
        <DialogFooter className="mt-6 flex justify-center">
          <DialogClose asChild>
            <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white">
              Закрыть
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RoomStateDialog;