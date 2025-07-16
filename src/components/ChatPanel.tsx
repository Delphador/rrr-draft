"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  sender: string;
  text: string;
  timestamp: string;
}

interface ChatPanelProps {
  currentUserNickname: string;
  currentUserRole: 'captain' | 'spectator' | '';
  currentUserTeam?: 'Team 1' | 'Team 2' | '';
}

const ChatPanel: React.FC<ChatPanelProps> = ({ currentUserNickname, currentUserRole, currentUserTeam }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() === "") return;

    const senderInfo = currentUserNickname || "Гость";
    const roleInfo = currentUserRole === 'captain' ? ` (Капитан ${currentUserTeam})` : (currentUserRole === 'spectator' ? ' (Зритель)' : '');
    const fullSender = `${senderInfo}${roleInfo}`;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: fullSender, text: newMessage.trim(), timestamp },
    ]);
    setNewMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-24 right-4 w-full md:w-80 bg-card rounded-lg shadow-lg p-4 z-50 flex flex-col max-h-[calc(50vh-32px)] md:max-h-[calc(100vh-32px)]">
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-xl font-bold text-center text-foreground">Чат</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-[200px] pr-2"> {/* Fixed height for chat messages */}
          <div className="space-y-2">
            {messages.length > 0 ? (
              messages.map((msg, index) => (
                <div key={index} className="text-sm">
                  <span className="font-semibold text-primary-foreground">{msg.sender}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{msg.timestamp}</span>
                  <p className="text-foreground break-words">{msg.text}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground text-sm">Начните общение!</p>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-0 pt-4 flex gap-2">
        <Input
          type="text"
          placeholder="Напишите сообщение..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-grow"
        />
        <Button onClick={handleSendMessage}>Отправить</Button>
      </CardFooter>
    </div>
  );
};

export default ChatPanel;