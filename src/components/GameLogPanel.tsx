"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GameLogPanelProps {
  gameLog: string[];
}

const GameLogPanel: React.FC<GameLogPanelProps> = ({ gameLog }) => {
  return (
    <div className="fixed left-4 top-4 w-80 bg-card rounded-lg shadow-lg p-4 z-50 max-h-[calc(100vh-32px)] flex flex-col">
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-xl font-bold text-center text-foreground">История драфта</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-0 pr-2">
        {gameLog.length > 0 ? (
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {gameLog.map((entry, index) => (
              <li key={index} className="text-sm">{entry}</li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-muted-foreground text-sm">История драфта будет отображаться здесь.</p>
        )}
      </CardContent>
    </div>
  );
};

export default GameLogPanel;