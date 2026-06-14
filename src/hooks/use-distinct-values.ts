'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { fetchUserProfile } from '@/lib/queries';

const cache: Record<string, string[]> = {};

export function useDistinctValues(table: string, column: string, isGlobal: boolean = false) {
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    
    async function load() {
      try {
        let storeId = null;
        if (!isGlobal) {
          const profile = await fetchUserProfile();
          if (profile) storeId = profile.store_id;
        }

        const cacheKey = `${table}:${column}:${storeId || 'global'}`;
        if (cache[cacheKey]) {
          if (isMounted) setValues(cache[cacheKey]);
          return;
        }

        const supabase = createClient();
        const { data, error } = await supabase.rpc('get_distinct_values', {
          p_table: table,
          p_column: column,
          p_store_id: storeId
        });

        if (!error && data) {
          const vals = data.map((d: any) => d.val);
          cache[cacheKey] = vals;
          if (isMounted) setValues(vals);
        }
      } catch (err) {
        console.error(`Failed to load distinct values for ${table}.${column}`, err);
      }
    }

    load();

    return () => { isMounted = false; };
  }, [table, column, isGlobal]);

  return values;
}
