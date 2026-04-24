'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, User, Bot, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { askAI } from '@/app/actions';

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await askAI(userMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    "What medications are running low?",
    "Suggest reorder quantities for next month",
    "List all items expiring in 7 days"
  ];

  return (
    <>
      {/* Trigger Button */}
      <Button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl shadow-primary/40 z-40 md:flex hidden items-center justify-center animate-bounce hover:animate-none"
      >
        <Sparkles size={24} />
      </Button>

      {/* Chat Panel */}
      <div className={cn(
        "fixed inset-y-0 right-0 w-full md:w-[400px] bg-background border-l border-border z-[100] flex flex-col shadow-2xl transition-transform duration-500 ease-in-out transform",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="p-6 bg-[#0f4c3a] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">AI Assistant</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-teal-300">Powered by Groq</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-white/10 rounded-full">
            <X size={20} />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/50 dark:bg-zinc-900/50">
          {messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-muted-foreground py-12">
                <div className="p-4 bg-primary/5 rounded-full">
                    <MessageSquare size={32} className="text-primary/40" />
                </div>
                <div>
                    <p className="font-bold text-foreground">How can I help you today?</p>
                    <p className="text-xs">Ask me about inventory, stock alerts, or reports.</p>
                </div>
                <div className="flex flex-col gap-2 w-full pt-4">
                    {suggestions.map((s, i) => (
                        <button 
                            key={i} 
                            onClick={() => setInput(s)}
                            className="text-[11px] font-bold text-primary bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 hover:bg-primary hover:text-white transition-all text-left"
                        >
                            {s}
                        </button>
                    ))}
                </div>
             </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn(
              "flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
              m.role === 'user' ? "flex-row-reverse" : "flex-row"
            )}>
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                m.role === 'user' ? "bg-primary text-white" : "bg-[#0f4c3a] text-white"
              )}>
                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={cn(
                "relative p-4 rounded-2xl text-sm font-medium shadow-sm max-w-[85%]",
                m.role === 'user' ? "bg-primary text-white rounded-tr-none" : "bg-white dark:bg-zinc-800 text-foreground border border-border rounded-tl-none"
              )}>
                {m.role === 'assistant' && (
                    <div className="absolute -top-3 left-0 bg-teal-500 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-sm ring-2 ring-white">AI</div>
                )}
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[#0f4c3a] text-white rounded-lg shrink-0 animate-pulse">
                <Bot size={16} />
              </div>
              <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                <Loader2 className="animate-spin text-primary" size={16} />
                <span className="text-xs text-muted-foreground font-bold italic">Assistant is typing...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-6 border-t border-border bg-background">
          <div className="flex gap-2 relative">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything..."
              className="h-12 pr-12 rounded-xl bg-zinc-50 border-zinc-200 focus:ring-4 focus:ring-primary/10 transition-all font-medium"
            />
            <Button 
                onClick={handleSend}
                size="icon" 
                className="absolute right-1 top-1 h-10 w-10 rounded-lg shadow-lg"
                disabled={!input.trim() || isLoading}
            >
              <Send size={18} />
            </Button>
          </div>
          <p className="mt-3 text-[9px] text-center text-muted-foreground font-bold uppercase tracking-widest">
            AI suggestions should be verified before action.
          </p>
        </div>
      </div>
    </>
  );
}
