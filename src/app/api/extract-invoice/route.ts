import { NextRequest, NextResponse } from 'next/server';
import { runGroq, runGemini, runGitHub } from '@/lib/ai-server';
import { createClient } from '@/utils/supabase/server';
import { fetchUserProfile } from '@/lib/queries';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();


    const { imageBase64, mimeType, preferredModel = 'auto' } = body;
    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    let textResponse = "";
    
    const runners = [
      { id: 'groq', name: 'Groq', run: () => runGroq(imageBase64) },
      { id: 'github', name: 'GitHub Models', run: () => runGitHub(imageBase64) },
      { id: 'gemini', name: 'Gemini', run: () => runGemini(imageBase64, mimeType) }
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
    const jsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
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
                
                const { data: existing, error: dbError } = await supabase
                   .from('purchase_invoices')
                   .select('id, invoice_date')
                   .eq('store_id', profile.store_id)
                   .ilike('distributor_name', parsedData.distributorName.trim())
                   .ilike('invoice_number', parsedData.invoiceNumber.trim())
                   .limit(1)
                   .maybeSingle();

                if (dbError) {
                   console.warn("[OCR] DB Error checking duplicate:", dbError);
                }

                if (existing) {
                   // We consider it a duplicate if Distributor and Invoice Number match. 
                   // Date format from OCR is too unreliable to include in the strict DB query.
                   return NextResponse.json({ error: `Duplicate invoice detected: Invoice #${parsedData.invoiceNumber} from ${parsedData.distributorName} already exists in your inventory.` }, { status: 409 });
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
