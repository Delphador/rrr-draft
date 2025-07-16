"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // Import Button for copy functionality
import { Copy } from "lucide-react"; // Import Copy icon
import { toast } from "sonner"; // Import toast for feedback

interface RegisteredUser {
  id: string;
  nickname: string;
  role: 'captain' | 'spectator';
  team?: 'Team 1' | 'Team 2';
}

interface RoomStatePanelProps {
  registeredUsers: RegisteredUser[];
  roomId: string | null;
  roomShortCode: string | null; // New prop for short code
}

const RoomStatePanel: React.FC<RoomStatePanelProps> = ({
  registeredUsers,
  roomId,
  roomShortCode,
}) => {
  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(message);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast.error("Не удалось скопировать.");
    });
  };

  return (
    <div className="fixed right-4 top-4 w-full md:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50 md:max-h-[calc(100vh-150px)] max-h-[calc(50vh-32px)] overflow-y-auto">
      <h2 className="text-xl font-bold mb-2 text-center text-gray-900 dark:text-gray-100">Состояние комнаты</h2>
      {roomShortCode && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
          Код комнаты: <span className="font-semibold text-primary">{roomShortCode}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => copyToClipboard(roomShortCode, "Код комнаты скопирован!")}
            className="h-6 w-6"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}
      {roomId && !roomShortCode && ( // Fallback to full ID if short code is not available
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
          ID комнаты: <span className="font-semibold text-primary">{roomId.substring(0, 8)}...</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => copyToClipboard(roomId, "ID комнаты скопирован!")}
            className="h-6 w-6"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
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