'use client';

import { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@khanij/ui';

interface Message {
  id: string;
  senderEmail?: string;
  content: string;
  createdAt: string;
}

interface DealChatProps {
  dealId: string;
  apiBaseUrl: string;
}

export function DealChat({ dealId, apiBaseUrl }: DealChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const wsUrl = `${apiBaseUrl.replace('http', 'ws')}/deal-room`;

  const { connected, send } = useWebSocket({
    url: wsUrl,
    onMessage: (data: unknown) => {
      const msg = data as { event?: string; data?: unknown };
      if (msg.event === 'deal-history') {
        setMessages((msg.data as Message[]) ?? []);
      } else if (msg.event === 'new-message') {
        setMessages((prev) => [...prev, msg.data as Message]);
      }
    },
  });

  useEffect(() => {
    if (connected) {
      send('join-deal', { dealId });
    }
  }, [connected, dealId, send]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    send('send-message', { dealId, content: input.trim() });
    setInput('');
  }

  return (
    <GlassCard className="flex flex-col h-[400px]">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-sm font-medium text-white">Deal Room Chat</span>
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-sage' : 'bg-red-400'}`} />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-base-500 text-sm py-8">
            {connected ? 'No messages yet. Start the conversation.' : 'Connecting...'}
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-accent-light">{msg.senderEmail ?? 'User'}</span>
              <span className="text-[10px] text-base-500">
                {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-white/90">{msg.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-white/5 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={connected ? 'Type a message...' : 'Reconnecting...'}
          disabled={!connected}
          className="glass-input flex-1 px-3 py-2 text-sm text-white placeholder:text-base-400"
        />
        <Button size="sm" type="submit" disabled={!connected || !input.trim()}>Send</Button>
      </form>
    </GlassCard>
  );
}
