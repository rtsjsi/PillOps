import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// 1. The universal strict prompt string defined once
const PROMPT = `You are an expert pharmacy data extraction AI.
Analyze this image of a distributor pharmaceutical invoice. Extract the tabular structured data perfectly.
Pay close attention to table headers.
Often, 'Rate' means Purchase Price, 'Disc' means Discount %, 'G%' means GST %, 'Exp' means Expiry Date.

Return ONLY a valid JSON object matching exactly this schema:
{
  "distributorName": string,
  "invoiceNumber": string,
  "invoiceDate": string (format YYYY-MM-DD, try to parse from the image),
  "items": [
    {
      "medicineName": string,
      "pack": string (e.g. "100G", "10T", "100 ml"),
      "hsnCode": string (usually a 4 to 8 digit number),
      "manufacturer": string (e.g. "WS", "ZDef", often under "Mfr"),
      "batchNumber": string,
      "quantity": number,
      "freeQuantity": number (default to 0 if not present, often marked as "FQ" or "Scheme"),
      "purchasePrice": number (the rate or price per unit, BEFORE tax/discount),
      "discountPercent": number (default to 0),
      "mrp": number (Maximum Retail Price),
      "gstPercent": number (e.g. 5, 12, 18),
      "expiryDate": string (format YYYY-MM. E.g if image says "07-27" convert to "2027-07". If "12/26" convert to "2026-12". This field is absolutely critical.),
      "totalAmount": number (The final row amount for that item) 
    }
  ],
  "subtotal": number (The taxable amount or gross total before GST),
  "discountAmount": number,
  "gstAmount": number (Total CGST+SGST or IGST combined),
  "total": number (Net amount to pay)
}`;

// --- TIER EXECUTORS ---

async function runGroq(imageBase64: string) {
  if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
  const client = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY });
  const chatCompletion = await client.chat.completions.create({
    messages: [
      { role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: imageBase64 } }] }
    ],
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    temperature: 0.1,
    response_format: { type: "json_object" },
  });
  return chatCompletion.choices[0]?.message?.content || '{}';
}

async function runGemini(imageBase64: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest", generationConfig: { responseMimeType: "application/json", temperature: 0.1 } });
  const result = await model.generateContent([PROMPT, { inlineData: { data: cleanBase64, mimeType: mimeType } }]);
  const response = await result.response;
  return response.text();
}

async function runGitHub(imageBase64: string) {
  if (!process.env.GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN");
  const client = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: process.env.GITHUB_TOKEN });
  const chatCompletion = await client.chat.completions.create({
    messages: [
      { role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: imageBase64 } }] }
    ],
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
  });
  return chatCompletion.choices[0]?.message?.content || '{}';
}



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
