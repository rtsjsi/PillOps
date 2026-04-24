import { NextRequest, NextResponse } from 'next/server';
import { runGroq, runGemini, runGitHub } from '@/lib/ai-server';
import { ratelimit } from '@/lib/redis';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate and Rate Limit
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use user ID as the rate limit key
    const { success, limit, reset, remaining } = await ratelimit.limit(user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          }
        }
      );
    }

    const body = await req.json();

    const { imageBase64, mimeType } = body;
    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    let textResponse = "";
    let executingTier = 1;

    try {
      console.log("[OCR] Attempting Tier 1: Groq");
      textResponse = await runGroq(imageBase64);
    } catch (e1) {
      console.warn(`[OCR] Tier 1 Groq Failed: ${(e1 as Error).message}`);
      executingTier = 2;
      
      try {
        console.log("[OCR] Attempting Tier 2: Gemini");
        textResponse = await runGemini(imageBase64, mimeType);
      } catch (e2) {
        console.warn(`[OCR] Tier 2 Gemini Failed: ${(e2 as Error).message}`);
        executingTier = 3;

        try {
          console.log("[OCR] Attempting Tier 3: GitHub Models");
          textResponse = await runGitHub(imageBase64);
        } catch (e3) {
          console.warn(`[OCR] Tier 3 GitHub Failed: ${(e3 as Error).message}`);
          return NextResponse.json(
             { error: 'All 3 Vision API Fallbacks failed or are missing API keys.' },
             { status: 503 }
          );
        }
      }
    }

    console.log(`[OCR] Success on Tier ${executingTier}`);
    
    // Safety fallback just in case the model wraps in markdown
    const jsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(jsonString);

    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error('OCR API Unknown Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process AI OCR' },
      { status: 500 }
    );
  }
}
