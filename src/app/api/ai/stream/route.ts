import { NextRequest } from 'next/server';
import { runGroq } from '@/lib/ai-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Since runGroq currently returns a full string, we'll simulate streaming for now
        // In a real prod app, we'd use the stream: true option in the OpenAI client
        const response = await runGroq(prompt);
        const tokens = response.split(' ');

        for (const token of tokens) {
          controller.enqueue(encoder.encode(token + ' '));
          await new Promise((resolve) => setTimeout(resolve, 50)); // Artificial delay for effect
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
