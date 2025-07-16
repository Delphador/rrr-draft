"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Character, CHARACTERS } from "@/data/characters"; // Import CHARACTERS to find character images
import { Ban, CheckCircle } from "lucide-react"; // Icons for ban/pick

interface GameLogPanelProps {
  gameLog: string[];
}

const GameLogPanel: React.FC<GameLogPanelProps> = ({ gameLog }) => {
  const parseLogEntry = (entry: string) => {
    const banMatch = entry.match(/(Team \d+) (автоматически забанил|забанил) (.+)\./);
    const pickMatch = entry.match(/(Team \d+) (автоматически выбрал|выбрал) (.+)\./);

    if (banMatch) {
      const [, team, , charName] = banMatch;
      const character = CHARACTERS.find(c => c.name === charName);
      return (
        <div className="flex items-center gap-2 text-sm">
          <Ban className="h-4 w-4 text-red-500 flex-shrink-0" />
          {character && <img src={character.image} alt={character.name} className="w-5 h-5 object-cover rounded-full flex-shrink-0" />}
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{team}</span> {banMatch[2]} <span className="font-semibold text-foreground">{charName}</span>.
          </span>
        </div>
      );
    } else if (pickMatch) {
      const [, team, , charName] = pickMatch;
      const character = CHARACTERS.find(c => c.name === charName);
      return (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          {character && <img src={character.image} alt={character.name} className="w-5 h-5 object-cover rounded-full flex-shrink-0" />}
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{team}</span> {pickMatch[2]} <span className="font-semibold text-foreground">{charName}</span>.
          </span>
        </div>
      );
    }
    return <li className="text-sm text-muted-foreground">{entry}</li>; // Fallback for unparsed entries
  };

  return (
    <div className="fixed left-4 top-4 w-80 bg-card rounded-lg shadow-lg p-4 z-50 max-h-[calc(100vh-32px)] flex flex-col">
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-xl font-bold text-center text-foreground">История драфта</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-0 pr-2">
        {gameLog.length > 0 ? (
          <div className="space-y-2">
            {gameLog.map((entry, index) => (
              <div key={index}>
                {parseLogEntry(entry)}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground text-sm">История драфта будет отображаться здесь.</p>
        )}
      </CardContent>
    </div>
  );
};

export default GameLogPanel;