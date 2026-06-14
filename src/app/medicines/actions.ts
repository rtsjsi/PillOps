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
      .select('id, name')
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
    for (const med of enrichedData.medicines) {
      const { id, ingredients, substitutes, storageConditions, isNarcotic, prescriptionRequired } = med;
      
      const { error: updateError } = await supabase
        .from('global_medicine_master')
        .update({
          ingredients: ingredients || [],
          substitutes: substitutes || [],
          storage_conditions: storageConditions || null,
          is_narcotic: isNarcotic || false,
          prescription_required: prescriptionRequired || false
        })
        .eq('id', id);
        
      if (!updateError) updatedCount++;
    }

    return { count: updatedCount, error: null };
  } catch (err: any) {
    return { count: 0, error: err.message || 'Failed to auto-enrich medicines' };
  }
}
