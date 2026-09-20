"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { parseEmailList } from "@/lib/emailList";

const AuthContext = createContext({
  user: null,
  condominio: null,
  member: null,
  role: null,
  loading: true,
  isAdmin: false,
  logout: async () => {},
  refreshCondominio: async () => {},
});

// Client-side hint only, used to decide whether to show the "Admin" nav
// link. The real access control happens server-side in /api/admin (see
// lib/adminAuth.js), which checks the private ADMIN_EMAILS env var.
const ADMIN_EMAILS = parseEmailList(process.env.NEXT_PUBLIC_ADMIN_EMAILS);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  // Resolves the signed-in user to either:
  // - a síndico/administradora (owns a row in condominios), or
  // - a delimited member (condômino/porteiro/conselheiro, has a row in
  //   membros pointing at someone else's condominio)
  // Row Level Security is what actually enforces this split server-side;
  // this just figures out which one applies so the UI can adapt. Both
  // queries run in parallel (most users only ever match one of them), and
  // the membro query embeds its condominio in the same round trip instead
  // of a separate follow-up query.
  const fetchAccess = useCallback(async (userId) => {
    if (!supabase || !userId) return { condominio: null, member: null };

    const [ownedResult, membroResult] = await Promise.all([
      supabase.from("condominios").select("*").eq("owner_id", userId).maybeSingle(),
      supabase.from("membros").select("*, condominios(*)").eq("user_id", userId).maybeSingle(),
    ]);

    if (ownedResult.error) console.error("Erro ao buscar condomínio:", ownedResult.error.message);
    if (ownedResult.data) return { condominio: ownedResult.data, member: null };

    if (membroResult.error) console.error("Erro ao buscar acesso:", membroResult.error.message);
    const membro = membroResult.data;
    if (!membro) return { condominio: null, member: null };

    const { condominios: condo, ...member } = membro;
    return { condominio: condo || null, member };
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
        const { condominio: c, member: m } = await fetchAccess(session.user.id);
        if (active) {
          setCondominio(c);
          setMember(m);
        }
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const { condominio: c, member: m } = await fetchAccess(session.user.id);
        setCondominio(c);
        setMember(m);
      } else {
        setCondominio(null);
        setMember(null);
      }
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [fetchAccess]);

  const logout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setCondominio(null);
    setMember(null);
  }, []);

  const refreshCondominio = useCallback(async () => {
    if (!user) return;
    const { condominio: c, member: m } = await fetchAccess(user.id);
    setCondominio(c);
    setMember(m);
  }, [user, fetchAccess]);

  const isAdmin = useMemo(
    () => Boolean(user?.email) && ADMIN_EMAILS.includes(user.email.toLowerCase()),
    [user]
  );

  // "sindico" also covers a condominio with no member row at all (the
  // owner), since ownership implies full access regardless of `member`.
  const role = useMemo(() => {
    if (!user) return null;
    if (member) return member.papel;
    if (condominio) return "sindico";
    return null;
  }, [user, member, condominio]);

  const value = useMemo(
    () => ({ user, condominio, member, role, loading, isAdmin, logout, refreshCondominio }),
    [user, condominio, member, role, loading, isAdmin, logout, refreshCondominio]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
