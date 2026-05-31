'use client';

import { useState, useEffect } from 'react';

interface AIStreamerProps {
  prompt: string;
}

export function AIStreamer({ prompt }: AIStreamerProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function streamResponse() {
      try {
        const response = await fetch('/api/ai/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });

        if (!response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          const chunk = decoder.decode(value, { stream: true });
          setText((prev) => prev + chunk);
        }
      } catch (error) {
        console.error('Streaming error:', error);
      } finally {
        setLoading(false);
      }
    }

    streamResponse();
  }, [prompt]);

  return (
    <div className="bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl shadow-sm p-6 min-h-[100px]">
      <p className="leading-relaxed text-foreground whitespace-pre-wrap">
        {text}
        {loading && <span className="inline-block w-0.5 h-4 ml-0.5 bg-primary animate-pulse align-middle" />}
      </p>
    </div>
  );
}
