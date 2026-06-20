import fs from 'fs';
import { runGroq } from './src/lib/ai-server';

import { config } from 'dotenv';
config({ path: '.env.local' });

async function test() {
    const images = [
        "C:\\Users\\rtsjsi\\.gemini\\antigravity-ide\\brain\\b314df24-9099-4251-97c0-e7ece07fd584\\media__1781943992325.jpg",
        "C:\\Users\\rtsjsi\\.gemini\\antigravity-ide\\brain\\b314df24-9099-4251-97c0-e7ece07fd584\\media__1781944002982.jpg"
    ];

    const imagePayloads = images.map(imgPath => {
        const base64 = fs.readFileSync(imgPath).toString('base64');
        return { base64: `data:image/jpeg;base64,${base64}`, mimeType: 'image/jpeg' };
    });

    console.log(`Sending ${imagePayloads.length} images to Groq...`);
    try {
        const response = await runGroq(imagePayloads, "meta-llama/llama-4-scout-17b-16e-instruct");
        fs.writeFileSync("test-output-raw.txt", response);
        
        let jsonString = response.replace(/```json/g, '').replace(/```/g, '').trim();
        jsonString = jsonString.replace(/[\u0000-\u001F]+/g, ' ');
        fs.writeFileSync("test-output-clean.json", jsonString);
        
        const parsed = JSON.parse(jsonString);
        console.log("✅ JSON parsed successfully!");
        console.log("Extracted Items Count:", parsed.items?.length);
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

test().catch(console.error);
