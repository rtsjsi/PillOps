'use server';

import { createClient } from '@/utils/supabase/server';

export async function searchGlobalMedicines(query: string = '') {
  try {
    const supabase = await createClient();
    
    // Ensure the user is logged in (staff level is fine)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    let queryBuilder = supabase
      .from('global_medicine_master')
      .select('*')
      .order('name', { ascending: true })
      .limit(50);

    if (query.trim() !== '') {
      // Use ilike for case-insensitive partial matching on name or generic_name
      queryBuilder = queryBuilder.or(`name.ilike.%${query}%,generic_name.ilike.%${query}%`);
    }

    const { data, error } = await queryBuilder;

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
      barcode: g.barcode,
      imageUrl: g.image_url,
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
      const { id, category, manufacturer, ingredients, substitutes, storageConditions, isNarcotic, prescriptionRequired } = med;
      
      const { error: updateError } = await adminDb
        .from('global_medicine_master')
        .update({
          category: category || undefined,
          manufacturer: manufacturer || undefined,
          ingredients: ingredients || [],
          substitutes: substitutes || [],
          storage_conditions: storageConditions || null,
          is_narcotic: isNarcotic || false,
          prescription_required: prescriptionRequired || false
        })
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
    
    // De-duplicate names
    const uniqueNames = Array.from(new Set(medicineNames.filter(n => typeof n === 'string' && n.trim() !== '')));
    if (uniqueNames.length === 0) return { data: {}, error: null };

    const supabase = await createClient();
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const adminDb = createAdminClient();

    // 1. Check which medicines already exist
    const { data: existing, error: fetchError } = await supabase
      .from('global_medicine_master')
      .select('id, name, manufacturer, category, ingredients, substitutes, storage_conditions, is_narcotic, prescription_required, hsn_code, gst_percent')
      .in('name', uniqueNames);

    if (fetchError) throw new Error(fetchError.message);

    const existingMap = new Map((existing || []).map(m => [m.name, m]));
    
    // 2. Filter missing or incomplete medicines
    const toEnrich: { id?: string, name: string, manufacturer?: string, category?: string }[] = [];
    
    for (const name of uniqueNames) {
      const med = existingMap.get(name);
      if (!med) {
        // Completely missing
        toEnrich.push({ name });
      } else if (!med.category || !med.ingredients || med.ingredients.length === 0 || med.ingredients === '[]') {
        // Exists but incomplete
        toEnrich.push({ id: med.id, name: med.name, manufacturer: med.manufacturer, category: med.category });
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

              const { category, manufacturer, ingredients, substitutes, storageConditions, isNarcotic, prescriptionRequired } = aiMed;
              const isNew = !originalChunkItem.id || chunk.find(c => c.name === originalChunkItem.name && !c.id);

              if (isNew) {
                // INSERT NEW
                const { data: newMed } = await adminDb
                  .from('global_medicine_master')
                  .insert({
                    name: originalChunkItem.name,
                    category: category || null,
                    manufacturer: manufacturer || null,
                    ingredients: ingredients || [],
                    substitutes: substitutes || [],
                    storage_conditions: storageConditions || null,
                    is_narcotic: isNarcotic || false,
                    prescription_required: prescriptionRequired || false
                  })
                  .select()
                  .single();
                  
                if (newMed) existingMap.set(newMed.name, newMed);
              } else {
                // UPDATE EXISTING
                const { data: updatedMed } = await adminDb
                  .from('global_medicine_master')
                  .update({
                    category: category || undefined,
                    manufacturer: manufacturer || undefined,
                    ingredients: ingredients || [],
                    substitutes: substitutes || [],
                    storage_conditions: storageConditions || null,
                    is_narcotic: isNarcotic || false,
                    prescription_required: prescriptionRequired || false
                  })
                  .eq('id', originalChunkItem.id)
                  .select()
                  .single();
                  
                if (updatedMed) existingMap.set(updatedMed.name, updatedMed);
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
    for (const [name, med] of Array.from(existingMap.entries())) {
      finalMap[name] = {
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
