"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

interface RegisteredUser {
  id: string;
  nickname: string;
  role: 'captain' | 'spectator';
  team?: 'Team 1' | 'Team 2';
}

interface RoomStatePanelProps {
  registeredUsers: RegisteredUser[];
  roomId: string | null; // Добавляем roomId для контекста
}

const RoomStatePanel: React.FC<RoomStatePanelProps> = ({
  registeredUsers,
  roomId,
}) => {
  return (
    <div className="fixed right-4 top-4 w-full md:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50 md:max-h-[calc(100vh-150px)] max-h-[calc(50vh-32px)] overflow-y-auto">
      <h2 className="text-xl font-bold mb-2 text-center text-gray-900 dark:text-gray-100">Состояние комнаты</h2>
      {roomId && (
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-2">
          ID комнаты: <span className="font-semibold">{roomId}</span>
        </p>
      )}
      <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
        Список зарегистрированных участников:
      </p>
      <div className="space-y-3 max-h-[calc(100vh-150px)] overflow-y-auto pr-2">
        {registeredUsers.length > 0 ? (
          registeredUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md shadow-sm">
              <div className="flex flex-col text-left">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{user.nickname}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Роль: {user.role === 'captain' ? 'Капитан' : 'Зритель'}
                  {user.team && ` | Команда: ${user.team}`}
                </span>
              </div>
              <Badge variant={user.role === 'captain' ? "default" : "secondary"} className={user.role === 'captain' ? "bg-indigo-500 hover:bg-indigo-600" : ""}>
                {user.role === 'captain' ? 'Капитан' : 'Зритель'}
              </Badge>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm">Пока нет зарегистрированных пользователей.</p>
        )}
      </div>
    </div>
  );
};

export default RoomStatePanel;