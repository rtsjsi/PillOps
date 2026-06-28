'use server';

import { createClient } from '@/utils/supabase/server';

function getSimilarity(s1: string, s2: string) {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  let longerLength = longer.length;
  if (longerLength == 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength.toString());
}

function editDistance(s1: string, s2: string) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  let costs = new Array();
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i == 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

export async function searchGlobalMedicines(query: string = '') {
  try {
    const supabase = await createClient();
    
    // Ensure the user is logged in (staff level is fine)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    let data: any[] | null = null;
    let error: any = null;
    
    if (query.trim() !== '') {
      // Use the smarter RPC function for fuzzy searching across multiple columns
      const result = await supabase
        .rpc('search_medicines', { search_term: query });
      data = result.data;
      error = result.error;
    } else {
      // Default to basic query for empty searches
      const result = await supabase
        .from('global_medicine_master')
        .select('id, name, generic_name, category, manufacturer, hsn_code, schedule, gst_percent, pack_size, uom, ingredients, substitutes, storage_conditions, is_narcotic, prescription_required')
        .order('name', { ascending: true })
        .limit(50);
      data = result.data;
      error = result.error;
    }

    if (error) throw new Error(error.message);

    // Map snake_case to camelCase
    const mapped = (data ?? []).map(g => ({
      id: g.id,
      name: g.name,
      genericName: g.generic_name,
      category: g.category,
      manufacturer: g.manufacturer,
      hsnCode: g.hsn_code,
      schedule: g.schedule,
      gstPercent: g.gst_percent,
      packSize: g.pack_size,
      uom: g.uom,
      ingredients: g.ingredients || [],
      substitutes: g.substitutes || [],
      storageConditions: g.storage_conditions,
      isNarcotic: g.is_narcotic,
      prescriptionRequired: g.prescription_required,
    }));

    return { data: mapped, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to search medicines' };
  }
}

export async function autoEnrichMedicines() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 1. Fetch up to 10 medicines that need enrichment
    const { data: incompleteMedicines, error: fetchError } = await supabase
      .from('global_medicine_master')
      .select('id, name, manufacturer, category')
      .or('ingredients.is.null,ingredients.eq."[]"')
      .limit(10);

    if (fetchError) throw new Error(fetchError.message);
    if (!incompleteMedicines || incompleteMedicines.length === 0) {
      return { count: 0, message: 'All medicines are already enriched!', error: null };
    }

    // 2. Call our AI Server function
    const { enrichMedicineBatchWithGroq } = await import('@/lib/ai-server');
    const aiResponseString = await enrichMedicineBatchWithGroq(incompleteMedicines);
    
    let enrichedData;
    try {
      enrichedData = JSON.parse(aiResponseString);
    } catch (e) {
      throw new Error('Failed to parse AI response: ' + aiResponseString);
    }

    if (!enrichedData?.medicines || !Array.isArray(enrichedData.medicines)) {
      throw new Error('Unexpected AI response format');
    }

    // 3. Update the database in a loop
    let updatedCount = 0;
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const adminDb = createAdminClient();

    for (const med of enrichedData.medicines) {
      const { id, correctedName, category, manufacturer, packSize, hsnCode, gstPercent, ingredients, substitutes, storageConditions, isNarcotic, prescriptionRequired } = med;
      
      const updatePayload: any = {
          category: category || undefined,
          manufacturer: manufacturer || undefined,
          pack_size: packSize || undefined,
          hsn_code: hsnCode || undefined,
          gst_percent: gstPercent || undefined,
          ingredients: ingredients || [],
          substitutes: substitutes || [],
          storage_conditions: storageConditions || null,
          is_narcotic: isNarcotic || false,
          prescription_required: prescriptionRequired || false
      };

      if (correctedName) {
         updatePayload.name = correctedName.toUpperCase();
      }

      const { error: updateError } = await adminDb
        .from('global_medicine_master')
        .update(updatePayload)
        .eq('id', id);
        
      if (!updateError) updatedCount++;
      else console.error('Error updating medicine:', updateError);
    }

    return { count: updatedCount, error: null };
  } catch (err: any) {
    return { count: 0, error: err.message || 'Failed to auto-enrich medicines' };
  }
}

export async function checkAndEnrichInvoiceMedicines(medicineNames: string[]) {
  try {
    if (!medicineNames || medicineNames.length === 0) return { data: {}, error: null };
    
    // De-duplicate names and force UPPERCASE
    const uniqueNames = Array.from(new Set(medicineNames.filter(n => typeof n === 'string' && n.trim() !== '').map(n => n.toUpperCase())));
    if (uniqueNames.length === 0) return { data: {}, error: null };

    const supabase = await createClient();
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const adminDb = createAdminClient();

    // 1. Fetch Candidates (Exact + Fuzzy)
    const candidates: any[] = [];
    const { data: exactMatches, error: fetchError } = await supabase
      .from('global_medicine_master')
      .select('id, name, manufacturer, category, ingredients, substitutes, storage_conditions, is_narcotic, prescription_required, hsn_code, gst_percent')
      .in('name', uniqueNames);

    if (fetchError) throw new Error(fetchError.message);
    if (exactMatches) candidates.push(...exactMatches);

    const exactNames = new Set(exactMatches?.map(m => m.name.toLowerCase()) || []);
    const missingForFuzzy = uniqueNames.filter(n => !exactNames.has(n.toLowerCase()));

    if (missingForFuzzy.length > 0) {
       const searchTokens = missingForFuzzy.map(n => n.split(/[\s-]+/)[0].replace(/[^a-zA-Z0-9]/g, '')).filter(t => t.length > 2);
       if (searchTokens.length > 0) {
          const { data: fuzzyCandidates } = await supabase
             .from('global_medicine_master')
             .select('id, name, manufacturer, category, ingredients, substitutes, storage_conditions, is_narcotic, prescription_required, hsn_code, gst_percent')
             .or(searchTokens.map(t => `name.ilike.%${t}%`).join(','));
             
          if (fuzzyCandidates) {
             const candidateIds = new Set(candidates.map(c => c.id));
             for (const fc of fuzzyCandidates) {
                if (!candidateIds.has(fc.id)) candidates.push(fc);
             }
          }
       }
    }

    const existingMap = new Map();
    const toEnrich: { id?: string, name: string, manufacturer?: string, category?: string }[] = [];

    // 2. Map OCR names to the best candidate
    for (const name of uniqueNames) {
      let bestMatch = null;
      let highestSim = 0;

      for (const candidate of candidates) {
        if (candidate.name.toLowerCase() === name.toLowerCase()) {
           bestMatch = candidate;
           highestSim = 1;
           break;
        }
        const sim = getSimilarity(name.toLowerCase(), candidate.name.toLowerCase());
        if (sim > highestSim) {
           highestSim = sim;
           bestMatch = candidate;
        }
      }

      if (bestMatch && highestSim > 0.8) {
         existingMap.set(name, bestMatch);
         if (!bestMatch.category || !bestMatch.ingredients || bestMatch.ingredients.length === 0 || bestMatch.ingredients === '[]') {
            toEnrich.push({ id: bestMatch.id, name: name, manufacturer: bestMatch.manufacturer, category: bestMatch.category });
         }
      } else {
         toEnrich.push({ name });
      }
    }

    // 3. Enrich missing/incomplete ones
    if (toEnrich.length > 0) {
      const { enrichMedicineBatchWithGroq } = await import('@/lib/ai-server');
      
      // Batch in chunks of 15 to respect AI limits/timeouts
      const CHUNK_SIZE = 15;
      for (let i = 0; i < toEnrich.length; i += CHUNK_SIZE) {
        const chunk = toEnrich.slice(i, i + CHUNK_SIZE);
        
        // Ensure ID is generated for completely missing ones so AI returns it
        const chunkWithIds = chunk.map(c => ({
          ...c,
          id: c.id || crypto.randomUUID()
        }));

        try {
          const aiResponseString = await enrichMedicineBatchWithGroq(chunkWithIds);
          const enrichedData = JSON.parse(aiResponseString);
          
          if (enrichedData?.medicines && Array.isArray(enrichedData.medicines)) {
            for (const aiMed of enrichedData.medicines) {
              const originalChunkItem = chunkWithIds.find(c => c.id === aiMed.id);
              if (!originalChunkItem) continue;

              const { category, manufacturer, packSize, hsnCode, gstPercent, ingredients, substitutes, storageConditions, isNarcotic, prescriptionRequired } = aiMed;
              const isNew = !originalChunkItem.id || chunk.find(c => c.name === originalChunkItem.name && !c.id);

              const correctedName = (aiMed.correctedName || originalChunkItem.name).toUpperCase();

              if (isNew) {
                // Check if the corrected name already exists (e.g. AI fixed a typo, and the correct name is in DB)
                let { data: existingCorrected } = await adminDb
                   .from('global_medicine_master')
                   .select('id, name, manufacturer, category, ingredients, substitutes, storage_conditions, is_narcotic, prescription_required, hsn_code, gst_percent')
                   .eq('name', correctedName)
                   .maybeSingle();

                if (existingCorrected) {
                   existingMap.set(originalChunkItem.name, existingCorrected);
                } else {
                   // INSERT NEW
                   const { data: newMed } = await adminDb
                     .from('global_medicine_master')
                     .insert({
                       name: correctedName,
                       category: category || null,
                       manufacturer: manufacturer || null,
                       pack_size: packSize || null,
                       hsn_code: hsnCode || null,
                       gst_percent: gstPercent || 12,
                       ingredients: ingredients || [],
                       substitutes: substitutes || [],
                       storage_conditions: storageConditions || null,
                       is_narcotic: isNarcotic || false,
                       prescription_required: prescriptionRequired || false
                     })
                     .select()
                     .single();
                     
                   if (newMed) existingMap.set(originalChunkItem.name, newMed);
                }
              } else {
                // UPDATE EXISTING
                const { data: updatedMed } = await adminDb
                  .from('global_medicine_master')
                  .update({
                    name: correctedName, // Update the name to the AI corrected one in uppercase
                    category: category || undefined,
                    manufacturer: manufacturer || undefined,
                    pack_size: packSize || undefined,
                    hsn_code: hsnCode || undefined,
                    gst_percent: gstPercent || undefined,
                    ingredients: ingredients || [],
                    substitutes: substitutes || [],
                    storage_conditions: storageConditions || null,
                    is_narcotic: isNarcotic || false,
                    prescription_required: prescriptionRequired || false
                  })
                  .eq('id', originalChunkItem.id)
                  .select()
                  .single();
                  
                if (updatedMed) existingMap.set(originalChunkItem.name, updatedMed);
              }
            }
          }
        } catch (err) {
          console.error('Enrichment batch failed:', err);
        }
      }
    }

    // 4. Return the enriched mapping
    const finalMap: Record<string, any> = {};
    for (const [originalName, med] of Array.from(existingMap.entries())) {
      finalMap[originalName] = {
        name: med.name, // Pass the corrected/matched name back to the UI
        category: med.category,
        manufacturer: med.manufacturer,
        hsnCode: med.hsn_code,
        gstPercent: med.gst_percent,
        isNarcotic: med.is_narcotic,
        prescriptionRequired: med.prescription_required
      };
    }

    return { data: finalMap, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to check and enrich medicines' };
  }
}

export async function addGlobalMedicine(data: { name: string, category: string, manufacturer: string }) {
  try {
    const supabase = await createClient();
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const adminDb = createAdminClient();

    // Enforce UPPERCASE name
    const medName = data.name.toUpperCase();

    // Basic AI enrichment
    const { enrichMedicineBatchWithGroq } = await import('@/lib/ai-server');
    const chunk = [{ id: crypto.randomUUID(), name: medName, category: data.category, manufacturer: data.manufacturer }];
    let aiMed = chunk[0] as any;
    
    try {
      const aiResponseString = await enrichMedicineBatchWithGroq(chunk);
      const enrichedData = JSON.parse(aiResponseString);
      if (enrichedData?.medicines?.length > 0) {
        aiMed = enrichedData.medicines[0];
      }
    } catch (e) {
      console.warn('AI Enrichment failed during manual add:', e);
      // Fallback to basic data provided by user
    }

    const { category, manufacturer, packSize, hsnCode, gstPercent, ingredients, substitutes, storageConditions, isNarcotic, prescriptionRequired } = aiMed;
    const correctedName = (aiMed.correctedName || medName).toUpperCase();

    const { data: newMed, error } = await adminDb
      .from('global_medicine_master')
      .insert({
        name: correctedName,
        category: category || data.category,
        manufacturer: manufacturer || data.manufacturer,
        pack_size: packSize || null,
        hsn_code: hsnCode || null,
        gst_percent: gstPercent || 12,
        ingredients: ingredients || [],
        substitutes: substitutes || [],
        storage_conditions: storageConditions || null,
        is_narcotic: isNarcotic || false,
        prescription_required: prescriptionRequired || false
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('A medicine with this name already exists.');
      }
      throw new Error(error.message);
    }

    return { data: newMed, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to add medicine' };
  }
}

export async function fetchMedicineDetailsFromAI(name: string) {
  try {
    const { enrichMedicineBatchWithGroq } = await import('@/lib/ai-server');
    const chunk = [{ id: crypto.randomUUID(), name: name.toUpperCase() }];
    
    const aiResponseString = await enrichMedicineBatchWithGroq(chunk);
    const enrichedData = JSON.parse(aiResponseString);
    
    if (enrichedData?.medicines && enrichedData.medicines.length > 0) {
      const aiMed = enrichedData.medicines[0];
      return { 
        data: {
          name: aiMed.correctedName || name.toUpperCase(),
          category: aiMed.category || '',
          manufacturer: aiMed.manufacturer || ''
        }, 
        error: null 
      };
    }
    throw new Error('AI returned no data');
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch AI details' };
  }
}

export async function enrichSingleMedicine(medicine: { id: string, name: string, manufacturer?: string, category?: string }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { enrichMedicineBatchWithGroq } = await import('@/lib/ai-server');
    const aiResponseString = await enrichMedicineBatchWithGroq([medicine]);
    
    let enrichedData;
    try {
      enrichedData = JSON.parse(aiResponseString);
    } catch (e) {
      throw new Error('Failed to parse AI response: ' + aiResponseString);
    }

    if (!enrichedData?.medicines || !Array.isArray(enrichedData.medicines) || enrichedData.medicines.length === 0) {
      throw new Error('AI returned no data');
    }

    const { createAdminClient } = await import('@/utils/supabase/admin');
    const adminDb = createAdminClient();

    const med = enrichedData.medicines[0];
    const { id, correctedName, category, manufacturer, packSize, hsnCode, gstPercent, ingredients, substitutes, storageConditions, isNarcotic, prescriptionRequired } = med;
    
    const updatePayload: any = {
        category: category || undefined,
        manufacturer: manufacturer || undefined,
        pack_size: packSize || undefined,
        hsn_code: hsnCode || undefined,
        gst_percent: gstPercent || undefined,
        ingredients: ingredients || [],
        substitutes: substitutes || [],
        storage_conditions: storageConditions || null,
        is_narcotic: isNarcotic || false,
        prescription_required: prescriptionRequired || false
    };

    if (correctedName) {
       updatePayload.name = correctedName.toUpperCase();
    }

    const { error: updateError } = await adminDb
      .from('global_medicine_master')
      .update(updatePayload)
      .eq('id', id);
      
    if (updateError) throw new Error(updateError.message);

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to enrich medicine' };
  }
}

