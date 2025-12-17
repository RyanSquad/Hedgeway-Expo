import { supabase } from './supabase';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Generic database query helper
 */
export async function query<T>(
  table: string,
  options?: {
    select?: string;
    filters?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  }
) {
  try {
    let query = supabase.from(table).select(options?.select || '*');

    // Apply filters
    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    // Apply ordering
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }

    // Apply limit
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { data: data as T[], error: null };
  } catch (error) {
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Insert a new record
 */
export async function insert<T>(
  table: string,
  record: Partial<T>
) {
  try {
    const { data, error } = await supabase
      .from(table)
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Update a record
 */
export async function update<T>(
  table: string,
  id: string | number,
  updates: Partial<T>
) {
  try {
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Delete a record
 */
export async function remove(
  table: string,
  id: string | number
) {
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as PostgrestError };
  }
}

/**
 * Real-time subscription helper
 */
export function subscribe<T>(
  table: string,
  callback: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: T; old: T }) => void,
  filters?: string
) {
  const channel = supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: filters,
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as T,
          old: payload.old as T,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

