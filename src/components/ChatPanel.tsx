"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client"; // Import supabase client
import { toast } from "sonner"; // Import toast for feedback

interface Message {
  id: string;
  sender_nickname: string;
  sender_role: string;
  sender_team?: string;
  text: string;
  created_at: string;
}

interface ChatPanelProps {
  currentUserNickname: string;
  currentUserRole: 'captain' | 'spectator' | '';
  currentUserTeam?: 'Team 1' | 'Team 2' | '';
  roomId: string | null; // New prop: roomId
}

const ChatPanel: React.FC<ChatPanelProps> = ({ currentUserNickname, currentUserRole, currentUserTeam, roomId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch initial messages and subscribe to real-time updates
  useEffect(() => {
    if (!roomId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('room_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        toast.error("Ошибка при загрузке сообщений чата.");
      } else {
        setMessages(data as Message[]);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`room_chat_${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` }, payload => {
        console.log('New chat message received!', payload);
        setMessages((prevMessages) => [...prevMessages, payload.new as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async () => {
    if (newMessage.trim() === "" || !roomId || !currentUserNickname) return;

    const { error } = await supabase
      .from('room_messages')
      .insert({
        room_id: roomId,
        sender_nickname: currentUserNickname,
        sender_role: currentUserRole,
        sender_team: currentUserTeam,
        text: newMessage.trim(),
      });

    if (error) {
      console.error("Error sending message:", error);
      toast.error("Ошибка при отправке сообщения.");
    } else {
      setNewMessage("");
    }
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
              messages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="font-semibold text-primary-foreground">{msg.sender_nickname}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
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
          disabled={!roomId || !currentUserNickname}
        />
        <Button onClick={handleSendMessage} disabled={!roomId || !currentUserNickname}>Отправить</Button>
      </CardFooter>
    </div>
  );
};

export default ChatPanel;