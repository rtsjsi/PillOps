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
