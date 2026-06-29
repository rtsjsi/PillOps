require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.dev.vars' }); // Just in case
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGroq() {
  console.log('Testing Groq...');
  try {
    const client = new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: process.env.GROQ_API_KEY });
    
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
    
    const res = await client.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: JSON.stringify([{ id: 'test-1', name: 'Dlo 650 Mg Tab' }]) }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    console.log('Groq Result:', res.choices[0]?.message?.content);
  } catch (e) {
    console.error('Groq Error:', e.message);
  }
}

async function testGemini() {
  console.log('\nTesting Gemini...');
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest', generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } });
    
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
    
    const result = await model.generateContent([
      systemPrompt, 
      JSON.stringify([{ id: 'test-1', name: 'Dlo 650 Mg Tab' }])
    ]);
    const response = await result.response;
    console.log('Gemini Result:', response.text());
  } catch (e) {
    console.error('Gemini Error:', e.message);
  }
}

async function run() {
  await testGroq();
  await testGemini();
}
run();
