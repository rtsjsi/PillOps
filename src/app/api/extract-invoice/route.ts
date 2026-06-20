import { NextRequest, NextResponse } from 'next/server';
import { runGroq, runGemini } from '@/lib/ai-server';
import { createClient } from '@/utils/supabase/server';
import { fetchUserProfile } from '@/lib/queries';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { images, preferredModel = 'auto' } = body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    let textResponse = "";
    
    const runners = [
      { id: 'llama-4-scout', name: 'Llama 4 Scout 17B', run: () => runGroq(images, "meta-llama/llama-4-scout-17b-16e-instruct") },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', run: () => runGemini(images, "gemini-2.5-flash") },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', run: () => runGemini(images, "gemini-flash-latest") }
    ];

    if (preferredModel !== 'auto') {
       const selectedRunner = runners.find(r => r.id === preferredModel);
       if (!selectedRunner) {
           return NextResponse.json({ error: 'Invalid model selected' }, { status: 400 });
       }
       
       console.log(`[OCR] Attempting user-selected model: ${selectedRunner.name}`);
       try {
         textResponse = await selectedRunner.run();
         console.log(`[OCR] Success on user-selected model: ${selectedRunner.name}`);
       } catch (e: any) {
         console.warn(`[OCR] User-selected model ${selectedRunner.name} failed: ${e.message}`);
         return NextResponse.json({ error: `Selected model failed: ${e.message}` }, { status: 503 });
       }
    } else {
       let executingTier = 1;
       let success = false;
       for (const runner of runners) {
          console.log(`[OCR] Attempting Tier ${executingTier}: ${runner.name}`);
          try {
             textResponse = await runner.run();
             console.log(`[OCR] Success on Tier ${executingTier}`);
             success = true;
             break;
          } catch (e: any) {
             console.warn(`[OCR] Tier ${executingTier} ${runner.name} Failed: ${e.message}`);
             executingTier++;
          }
       }
       
       if (!success) {
         return NextResponse.json(
            { error: 'All Vision API Fallbacks failed or are missing API keys.' },
            { status: 503 }
         );
       }
    }
    
    // Safety fallback just in case the model wraps in markdown
    let jsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Robust JSON sanitization state machine: fixes trailing commas and unescaped control chars
    function fixJson(str: string) {
      let inString = false;
      let escape = false;
      let result = '';
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '\\' && !escape) {
          escape = true;
          result += char;
          continue;
        }
        if (char === '"' && !escape) {
          inString = !inString;
        }
        escape = false;
        
        if (inString) {
          const code = char.charCodeAt(0);
          if (code < 32) {
            result += ' '; // Convert literal newlines/tabs inside strings to space
            continue;
          }
        }
        
        if (!inString && char === ',') {
          let nextChar = '';
          for (let j = i + 1; j < str.length; j++) {
            if (str[j] !== ' ' && str[j] !== '\n' && str[j] !== '\r' && str[j] !== '\t') {
              nextChar = str[j];
              break;
            }
          }
          if (nextChar === '}' || nextChar === ']') {
            continue; // Skip trailing comma
          }
        }
        result += char;
      }
      return result;
    }

    jsonString = fixJson(jsonString);
    const parsedData = JSON.parse(jsonString);

    // Math Validation
    const validationWarnings: string[] = [];
    if (parsedData && Array.isArray(parsedData.items)) {
      parsedData.items.forEach((item: any, index: number) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.purchasePrice) || 0;
        const gst = Number(item.gstPercent) || 0;
        const mrp = Number(item.mrp) || 0;
        const total = Number(item.totalAmount) || 0;
        
        if (mrp > 0 && price > 0 && mrp >= price && !item.discountPercent) {
            item.discountPercent = Number((((mrp - price) / mrp) * 100).toFixed(2));
        }

        const expectedTotal = qty * price * (1 + gst / 100);
        // Check if there is a discrepancy (allowing for > 10% error or > 10 rupees difference)
        const diff = Math.abs(expectedTotal - total);
        if (expectedTotal > 0 && total > 0 && (diff > expectedTotal * 0.1 || diff > 10)) {
           validationWarnings.push(`Row ${index + 1} (${item.medicineName || 'Unknown'}): Qty (${qty}) * Rate (${price}) + GST (${gst}%) = ${expectedTotal.toFixed(2)}, but extracted total is ${total}. Please review.`);
        }
      });
    }
    
    if (validationWarnings.length > 0) {
       parsedData.validationWarnings = validationWarnings;
    }

    // Duplicate Check
    try {
        if (parsedData.distributorName && parsedData.invoiceNumber && parsedData.invoiceDate) {
            const profile = await fetchUserProfile();
            if (profile?.store_id) {
                const supabase = await createClient();
                
                // Try parsing the OCR date to YYYY-MM-DD for DB
                let parsedDateForDB: string | null = null;
                if (parsedData.invoiceDate) {
                    if (/^\d{2}-\d{2}-\d{4}$/.test(parsedData.invoiceDate)) {
                        const [dd, mm, yyyy] = parsedData.invoiceDate.split('-');
                        parsedDateForDB = `${yyyy}-${mm}-${dd}`;
                    } else if (/^\d{4}-\d{2}-\d{2}$/.test(parsedData.invoiceDate)) {
                        parsedDateForDB = parsedData.invoiceDate;
                    }
                }

                const { data: existing, error: dbError } = await supabase.rpc('check_duplicate_invoice', {
                   p_store_id: profile.store_id,
                   p_distributor_name: parsedData.distributorName,
                   p_invoice_number: parsedData.invoiceNumber,
                   p_invoice_date: parsedDateForDB
                });

                if (dbError) {
                   console.warn("[OCR] DB Error checking duplicate via RPC:", dbError);
                }

                if (existing) {
                   // Warn but allow proceeding (Option B) — OCR can misread invoice numbers
                   parsedData.duplicateWarning = `Invoice #${parsedData.invoiceNumber} from ${parsedData.distributorName} may already exist in your inventory. Please verify before saving.`;
                }
            }
        }
    } catch (e: any) {
        console.warn("[OCR] Could not perform duplicate check:", e.message);
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
