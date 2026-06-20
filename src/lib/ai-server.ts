export const PROMPT = `You are an expert pharmacy data extraction AI.
Analyze this image of a distributor pharmaceutical invoice. Extract the tabular structured data perfectly.
Pay close attention to table headers.
Often, 'Rate' means Purchase Price, 'Disc' means Discount %, 'G%' means GST %, 'Exp' means Expiry Date, 'Qty' or 'Billed' means Quantity.

CRITICAL INSTRUCTIONS:
1. Chain of Thought: First, in the "rawTranscription" field, write out a literal transcription of the entire items table exactly as you see it row-by-row. This scratchpad helps you maintain spatial alignment.
2. Extract EVERY SINGLE ROW in the invoice items table. DO NOT skip, summarize, or truncate any items.
3. ZERO HALLUCINATION POLICY: DO NOT guess or default to 1 for quantities. Find the exact column for 'Qty', 'Billed Qty', or 'Act' and extract the exact number.
4. OCR PRECISION: Pay extreme attention to similar-looking characters in Batch Numbers (e.g., 6 vs 8, 0 vs O, B vs 8, D vs 0). Double-check the image pixels carefully.
5. EXPIRY FORMATS: Look for the 'Exp' column. Indian invoices typically use MM/YY or MM-YY (e.g., "08/26" or "08-26"). Read the digits carefully.
6. EXACT MEDICINE NAMES: Do NOT clean, normalize, or truncate the medicine names. Extract the EXACT verbatim string written under the item/product name column, including all volume, packaging, and unit details (e.g. extract "CREMAFFIN SYP 225ML" exactly, NOT just "CREMAFFIN SYRUP").
7. DUPLICATE ROWS: Be extremely careful not to skip rows that have the same medicine name. Some invoices list the same item twice on consecutive lines (e.g. if there are two different batches). Treat them as separate items and extract BOTH rows. Count the total number of rows visually to ensure you don't miss any.

Return ONLY a valid JSON object matching exactly this schema:
{
  "rawTranscription": "string (The literal row-by-row transcription)",
  "distributorName": "string",
  "invoiceNumber": "string",
  "invoiceDate": "string (format YYYY-MM-DD)",
  "items": [
    {
      "medicineName": "string",
      "pack": "string",
      "hsnCode": "string",
      "manufacturer": "string",
      "batchNumber": "string (Look closely at 6 vs 8, 0 vs O)",
      "quantity": number (DO NOT default to 1. Find the Qty/Billed column. Must be exact.),
      "freeQuantity": number (default to 0, often "FQ" or "Scheme"),
      "purchasePrice": number (the Rate/price per unit BEFORE tax/discount),
      "discountPercent": number,
      "mrp": number,
      "gstPercent": number,
      "expiryDate": "string (format MM-YYYY. Convert MM/YY to MM-YYYY. Look very closely at the digits)",
      "totalAmount": number 
    }
  ],
  "subtotal": number,
  "discountAmount": number,
  "gstAmount": number,
  "total": number
}

IMPORTANT: You MUST return ONLY valid JSON. Do not include markdown formatting like ```json, and do not include any conversational text or preamble. Output JSON immediately.`;

// --- TIER EXECUTORS ---
// Note: We use dynamic imports for SDKs so they don't bloat the Cloudflare Worker 
// initialization time (Error 1102 fix).

export async function runGroq(imageBase64: string, modelName: string = "meta-llama/llama-4-scout-17b-16e-instruct") {
  if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY });
  const chatCompletion = await client.chat.completions.create({
    messages: [
      { role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: imageBase64 } }] }
    ],
    model: modelName,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });
  return chatCompletion.choices[0]?.message?.content || '{}';
}

export async function runGemini(imageBase64: string, mimeType: string, modelName: string = "gemini-flash-latest") {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json", temperature: 0.1 } });
  const result = await model.generateContent([PROMPT, { inlineData: { data: cleanBase64, mimeType: mimeType } }]);
  const response = await result.response;
  return response.text();
}





export async function enrichMedicineBatchWithGroq(medicines: {id: string, name: string, manufacturer?: string, category?: string}[]) {
  if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY });
  
  const systemPrompt = `You are a strict Indian pharmaceutical data AI. 
You will be given a JSON array of medicines containing 'id', 'name', and sometimes an abbreviated 'manufacturer' or empty 'category'.
For each medicine, return detailed clinical information including:
- category: String. The dosage form (e.g., "Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Cream", "Drops", "Powder"). Infer this from the name if possible.
- correctedName: String. The proper, standardized pharmaceutical name of the medicine (e.g., correcting "Dlo 650 Mg Tab" to "DOLO 650 TABLET" or "CROCIN ADVANCE"). This MUST BE ENTIRELY IN UPPERCASE. Fix any abbreviations or typos.
- manufacturer: String. The full, correct, standard name of the pharmaceutical company (e.g., "Sun Pharma", "Mankind Pharma", "Abbott"). Correct any abbreviations or misspellings.
- packSize: String or null. The standard packaging size (e.g. "10 Tablets", "100 ml", "15 gm"). Infer if possible, otherwise null.
- hsnCode: String or null. The applicable Indian HSN Code for this medicine (typically 3004xxxx).
- gstPercent: Number or null. The applicable GST percentage for this medicine (e.g. 5, 12, 18).
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
      "correctedName": "string",
      "category": "string",
      "manufacturer": "string",
      "packSize": "string",
      "hsnCode": "string",
      "gstPercent": 12,
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
