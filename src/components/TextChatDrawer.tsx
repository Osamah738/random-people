import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageSquare, Sparkles } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'me' | 'peer' | 'system';
  text: string;
  timestamp: number;
}

interface TextChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  peerCountry: string | null;
  isConnected: boolean;
}

export const TextChatDrawer: React.FC<TextChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  peerCountry,
  isConnected
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <div className="w-full md:w-80 h-72 md:h-full bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col z-20 shadow-2xl">
      {/* Header */}
      <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-850">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold text-white tracking-tight">
            Chat with {peerCountry || 'Stranger'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <p className="text-xs text-slate-400">
              {isConnected
                ? 'Say hello to your partner!'
                : 'Waiting for match to start chatting...'}
            </p>
          </div>
        )}

        {messages.map((m) => {
          if (m.sender === 'system') {
            return (
              <div key={m.id} className="text-center my-1.5">
                <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/50">
                  {m.text}
                </span>
              </div>
            );
          }

          const isMe = m.sender === 'me';
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  isMe
                    ? 'bg-rose-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-slate-800 bg-slate-850 flex items-center gap-1.5">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isConnected ? 'Type a message...' : 'Connect to chat...'}
          disabled={!isConnected}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || !isConnected}
          className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
