import { NextRequest, NextResponse } from 'next/server';
import { runGroq, runGemini, runGitHub } from '@/lib/ai-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();


    const { imageBase64, mimeType } = body;
    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    let textResponse = "";
    let executingTier = 1;

    try {
      console.log("[OCR] Attempting Tier 1: GitHub Models");
      textResponse = await runGitHub(imageBase64);
    } catch (e1) {
      console.warn(`[OCR] Tier 1 GitHub Failed: ${(e1 as Error).message}`);
      executingTier = 2;
      
      try {
        console.log("[OCR] Attempting Tier 2: Gemini");
        textResponse = await runGemini(imageBase64, mimeType);
      } catch (e2) {
        console.warn(`[OCR] Tier 2 Gemini Failed: ${(e2 as Error).message}`);
        executingTier = 3;

        try {
          console.log("[OCR] Attempting Tier 3: Groq");
          textResponse = await runGroq(imageBase64);
        } catch (e3) {
          console.warn(`[OCR] Tier 3 Groq Failed: ${(e3 as Error).message}`);
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

    // Math Validation
    const validationWarnings: string[] = [];
    if (parsedData && Array.isArray(parsedData.items)) {
      parsedData.items.forEach((item: any, index: number) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.purchasePrice) || 0;
        const total = Number(item.totalAmount) || 0;
        const expectedTotal = qty * price;
        // Check if there is a discrepancy (allowing for > 10% error or > 10 rupees difference)
        const diff = Math.abs(expectedTotal - total);
        if (expectedTotal > 0 && total > 0 && (diff > expectedTotal * 0.1 || diff > 10)) {
           validationWarnings.push(`Row ${index + 1} (${item.medicineName || 'Unknown'}): Qty (${qty}) * Rate (${price}) = ${expectedTotal.toFixed(2)}, but total extracted is ${total}. Please review.`);
        }
      });
    }
    
    if (validationWarnings.length > 0) {
       parsedData.validationWarnings = validationWarnings;
    }

    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error('OCR API Unknown Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process AI OCR' },
      { status: 500 }
    );
  }
}
