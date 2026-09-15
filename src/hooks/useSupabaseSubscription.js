import { useEffect, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';

// Realtime is intentionally not part of the entities shim — the Supabase
// postgres_changes payload (eventType/new/old) genuinely differs from
// base44's (type/data), so callers handle that shape directly rather than
// having it papered over. Relies on each table's RLS to scope what a given
// subscriber actually receives, rather than adding an explicit `filter`.
export function useSupabaseSubscription(table, onChange) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => onChangeRef.current(payload))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}
