'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';

/**
 * Abstracts data storage: Supabase when logged in, localStorage when not.
 * Works with any table that has a `user_id` column and matches the RLS policy.
 *
 * @param table        — Supabase table name (e.g. 'user_watchlists')
 * @param localKey     — localStorage key fallback (e.g. 'commodity_watchlists')
 * @param idField      — primary key field name, default 'id'
 */
export function useSupabaseData<T extends object>(
    table: string,
    localKey: string,
    idField: string = 'id',
) {
    const { user } = useAuth();
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    /* ── Load ──────────────────────────────────────────────── */
    const load = useCallback(async () => {
        setLoading(true);

        if (user) {
            const supabase = createClient();
            if (supabase) {
                const { data: rows, error } = await supabase
                    .from(table)
                    .select('*')
                    .order('created_at', { ascending: true });

                if (!error && rows) {
                    setData(rows as T[]);
                    setLoading(false);
                    return;
                }
            }
        }

        // Fallback to localStorage
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem(localKey);
                setData(raw ? JSON.parse(raw) : []);
            } catch { setData([]); }
        }
        setLoading(false);
    }, [user, table, localKey]);

    useEffect(() => { load(); }, [load]);

    /* ── Save full array (replaces all) ───────────────────── */
    const saveAll = useCallback(async (items: T[]) => {
        setData(items);

        if (user) {
            const supabase = createClient();
            if (supabase) {
                // Delete existing then insert fresh
                await supabase.from(table).delete().eq('user_id', user.id);
                if (items.length > 0) {
                    const rows = items.map(item => ({ ...item, user_id: user.id }));
                    await supabase.from(table).insert(rows);
                }
                return;
            }
        }

        localStorage.setItem(localKey, JSON.stringify(items));
    }, [user, table, localKey]);

    /* ── Upsert single item ───────────────────────────────── */
    const upsert = useCallback(async (item: T) => {
        if (user) {
            const supabase = createClient();
            if (supabase) {
                const row = { ...item, user_id: user.id };
                await supabase.from(table).upsert(row, { onConflict: idField });
                await load();
                return;
            }
        }

        // localStorage fallback
        setData(prev => {
            const idVal = (item as Record<string, unknown>)[idField];
            const idx = prev.findIndex(p => (p as Record<string, unknown>)[idField] === idVal);
            const next = idx >= 0 ? [...prev.slice(0, idx), item, ...prev.slice(idx + 1)] : [...prev, item];
            localStorage.setItem(localKey, JSON.stringify(next));
            return next;
        });
    }, [user, table, localKey, idField, load]);

    /* ── Remove by id ─────────────────────────────────────── */
    const remove = useCallback(async (id: string) => {
        if (user) {
            const supabase = createClient();
            if (supabase) {
                await supabase.from(table).delete().eq(idField, id);
                await load();
                return;
            }
        }

        setData(prev => {
            const next = prev.filter(p => (p as Record<string, unknown>)[idField] !== id);
            localStorage.setItem(localKey, JSON.stringify(next));
            return next;
        });
    }, [user, table, localKey, idField, load]);

    return { data, loading, saveAll, upsert, remove, reload: load };
}
