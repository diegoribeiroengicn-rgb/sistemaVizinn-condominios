"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const AuthContext = createContext({
  user: null,
  condominio: null,
  loading: true,
  logout: async () => {},
  refreshCondominio: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchCondominio = useCallback(async (userId) => {
    if (!supabase || !userId) return null;
    const { data, error } = await supabase
      .from("condominios")
      .select("*")
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) {
      console.error("Erro ao buscar condomínio:", error.message);
      return null;
    }
    return data;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        const c = await fetchCondominio(session.user.id);
        if (active) setCondominio(c);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const c = await fetchCondominio(session.user.id);
        setCondominio(c);
      } else {
        setCondominio(null);
      }
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [fetchCondominio]);

  const logout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setCondominio(null);
  }, []);

  const refreshCondominio = useCallback(async () => {
    if (!user) return;
    const c = await fetchCondominio(user.id);
    setCondominio(c);
  }, [user, fetchCondominio]);

  const value = useMemo(
    () => ({ user, condominio, loading, logout, refreshCondominio }),
    [user, condominio, loading, logout, refreshCondominio]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
