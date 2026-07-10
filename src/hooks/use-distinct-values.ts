'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useUserProfile } from '@/contexts/user-profile-context';

const cache: Record<string, string[]> = {};

export function useDistinctValues(table: string, column: string, isGlobal: boolean = false) {
  const { profile, loading: profileLoading } = useUserProfile();
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    if (!isGlobal && profileLoading) return;

    let isMounted = true;

    async function load() {
      try {
        const storeId = isGlobal ? null : profile?.store_id ?? null;
        if (!isGlobal && !storeId) {
          if (isMounted) setValues([]);
          return;
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
          p_store_id: storeId,
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
  }, [table, column, isGlobal, profile?.store_id, profileLoading]);

  return values;
}
