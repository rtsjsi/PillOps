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
    <div className="glass-card" style={{ padding: 'var(--space-4)', minHeight: '100px' }}>
      <p style={{ lineHeight: '1.6', color: 'var(--color-text-primary)' }}>
        {text}
        {loading && <span className="blinking-cursor">|</span>}
      </p>
      
      <style jsx>{`
        .blinking-cursor {
          display: inline-block;
          width: 2px;
          margin-left: 2px;
          background-color: var(--color-primary);
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          from, to { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
