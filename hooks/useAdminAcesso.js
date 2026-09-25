"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { ADMIN_MODULO_IDS } from "@/lib/adminModulos";

// "Quem sou eu no painel admin" — dono da plataforma (isAdmin do
// useAuth, allowlist client-side, só pra UI) sempre vê tudo; senão
// pergunta pro servidor (/api/admin/funcionarios/me) se esse login é
// um funcionário com acesso a algum módulo. A checagem real de
// segurança está sempre no servidor, em cada rota — isso aqui só
// decide o que mostrar (sidebar, guard).
export function useAdminAcesso() {
  const { user, isAdmin, loading: loadingAuth } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [modulosPermitidos, setModulosPermitidos] = useState([]);
  const [nomeFuncionario, setNomeFuncionario] = useState(null);

  useEffect(() => {
    if (loadingAuth) return;

    if (isAdmin) {
      setAutorizado(true);
      setModulosPermitidos(ADMIN_MODULO_IDS);
      setCarregando(false);
      return;
    }

    if (!user) {
      setAutorizado(false);
      setModulosPermitidos([]);
      setCarregando(false);
      return;
    }

    let ativo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        if (ativo) {
          setAutorizado(false);
          setCarregando(false);
        }
        return;
      }
      try {
        const res = await fetch("/api/admin/funcionarios/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!ativo) return;
        if (res.ok) {
          const json = await res.json();
          setAutorizado(true);
          setModulosPermitidos(json.modulosPermitidos || []);
          setNomeFuncionario(json.nome || null);
        } else {
          setAutorizado(false);
        }
      } catch {
        if (ativo) setAutorizado(false);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [loadingAuth, isAdmin, user]);

  return {
    carregando: carregando || loadingAuth,
    autorizado,
    isOwner: isAdmin,
    modulosPermitidos,
    nomeFuncionario,
    podeVer: (modulo) => isAdmin || modulosPermitidos.includes(modulo),
  };
}
