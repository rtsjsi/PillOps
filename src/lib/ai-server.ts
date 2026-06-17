export const PROMPT = `You are an expert pharmacy data extraction AI.
Analyze this image of a distributor pharmaceutical invoice. Extract the tabular structured data perfectly.
Pay close attention to table headers.
Often, 'Rate' means Purchase Price, 'Disc' means Discount %, 'G%' means GST %, 'Exp' means Expiry Date.

CRITICAL INSTRUCTIONS:
1. Chain of Thought: First, in the "rawTranscription" field, write out a literal transcription of the entire items table exactly as you see it row-by-row. This scratchpad helps you maintain spatial alignment.
2. Extract EVERY SINGLE ROW in the invoice items table. DO NOT skip, summarize, or truncate any items. If there are 20 items, you must return 20 objects in the "items" array.
3. Carefully scroll/read through the entire image from top to bottom.
4. Ensure you capture every detail on every line (quantity, batch, free quantity, GST, discount). If a field is blank, use 0 or "", but DO NOT omit the item itself.

Return ONLY a valid JSON object matching exactly this schema:
{
  "rawTranscription": "string (The literal row-by-row transcription of the invoice table)",
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
      "expiryDate": string (format MM-YYYY. E.g if image says "07-27" convert to "07-2027". If "12/26" convert to "12-2026". If not available, leave blank ""),
      "totalAmount": number (The final row amount for that item) 
    }
  ],
  "subtotal": number (The taxable amount or gross total before GST),
  "discountAmount": number,
  "gstAmount": number (Total CGST+SGST or IGST combined),
  "total": number (Net amount to pay)
}`;

// --- TIER EXECUTORS ---
// Note: We use dynamic imports for SDKs so they don't bloat the Cloudflare Worker 
// initialization time (Error 1102 fix).

export async function runGroq(imageBase64: string) {
  if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
  const { default: OpenAI } = await import('openai');
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

export async function runGemini(imageBase64: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest", generationConfig: { responseMimeType: "application/json", temperature: 0.1 } });
  const result = await model.generateContent([PROMPT, { inlineData: { data: cleanBase64, mimeType: mimeType } }]);
  const response = await result.response;
  return response.text();
}

export async function runGitHub(imageBase64: string) {
  if (!process.env.GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN");
  const { default: OpenAI } = await import('openai');
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

export async function chatWithGroq(userPrompt: string, systemPrompt: string = "You are a helpful pharmacy assistant for the PillOps platform.") {
  if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY });
  const chatCompletion = await client.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
  });
  return chatCompletion.choices[0]?.message?.content || 'I could not generate a response.';
}

export async function enrichMedicineBatchWithGroq(medicines: {id: string, name: string, manufacturer?: string, category?: string}[]) {
  if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY });
  
  const systemPrompt = `You are a strict Indian pharmaceutical data AI. 
You will be given a JSON array of medicines containing 'id', 'name', and sometimes an abbreviated 'manufacturer' or empty 'category'.
For each medicine, return detailed clinical information including:
- category: String. The dosage form (e.g., "Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Cream", "Drops", "Powder"). Infer this from the name if possible.
- manufacturer: String. The full, correct, standard name of the pharmaceutical company (e.g., "Sun Pharma", "Mankind Pharma", "Abbott"). Correct any abbreviations or misspellings.
- ingredients: Array of objects with 'salt' and 'strength' (e.g. [{"salt": "Paracetamol", "strength": "650mg"}]).
- substitutes: Array of strings containing 2-3 popular Indian generic equivalents/substitutes (e.g. ["Calpol 650", "Crocin 650"]).
- storageConditions: String describing how to store it (e.g. "Store below 30°C, protect from light").
- isNarcotic: boolean (true if it contains Codeine, Tramadol, etc under NDPS Act).
- prescriptionRequired: boolean (true for Rx only).

Return ONLY a valid JSON object with the following schema:
{
  "medicines": [
    {
      "id": "original-id",
      "category": "string",
      "manufacturer": "string",
      "ingredients": [{"salt": "string", "strength": "string"}],
      "substitutes": ["string"],
      "storageConditions": "string",
      "isNarcotic": boolean,
      "prescriptionRequired": boolean
    }
  ]
}`;

  const chatCompletion = await client.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(medicines) }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,
    response_format: { type: "json_object" },
  });
  return chatCompletion.choices[0]?.message?.content || '{"medicines":[]}';
}
