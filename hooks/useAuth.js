"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { parseEmailList } from "@/lib/emailList";
import { ALL_MODULOS } from "@/lib/permissoes";

const AuthContext = createContext({
  user: null,
  condominio: null,
  condominiosDoDono: [],
  temProPlusMulticondominios: false,
  proPlusTrialFim: null,
  trocarCondominio: () => {},
  member: null,
  role: null,
  permissoes: {},
  modulosVisiveis: [],
  temPermissao: () => false,
  loading: true,
  isAdmin: false,
  accessError: false,
  logout: async () => {},
  refreshCondominio: async () => {},
});

// Client-side hint only, used to decide whether to show the "Admin" nav
// link. The real access control happens server-side in /api/admin (see
// lib/adminAuth.js), which checks the private ADMIN_EMAILS env var.
const ADMIN_EMAILS = parseEmailList(process.env.NEXT_PUBLIC_ADMIN_EMAILS);

// Chave de localStorage pra lembrar qual condomínio ficou ativo pro
// Pro+ Multicondomínios (síndico/administradora com mais de 1
// condomínio) — por usuário, pra não vazar a escolha de uma conta pra
// outra no mesmo navegador.
function chaveCondominioAtivo(userId) {
  return `aquihabitto_condominio_ativo_${userId}`;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [condominiosDoDono, setCondominiosDoDono] = useState([]);
  const [temProPlusMulticondominios, setTemProPlusMulticondominios] = useState(false);
  const [proPlusTrialFim, setProPlusTrialFim] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [accessError, setAccessError] = useState(false);

  // Resolves the signed-in user to either:
  // - a síndico/administradora (owns 1+ linhas em condominios), ou
  // - a delimited member (condômino/porteiro/conselheiro, has a row in
  //   membros pointing at someone else's condominio)
  // Row Level Security is what actually enforces this split server-side;
  // this just figures out which one applies so the UI can adapt. Both
  // queries run in parallel (most users only ever match one of them), and
  // the membro query embeds its condominio in the same round trip instead
  // of a separate follow-up query.
  //
  // Um dono pode ter mais de 1 condomínio (Pro+ Multicondomínios) — por
  // isso não tem mais `.limit(1)` aqui. `condominioIdPreferido` é a
  // escolha salva no localStorage de uma sessão anterior; se não bater
  // com nenhum dos condomínios desse dono (ou não existir), cai no mais
  // antigo, mesmo comportamento de sempre.
  //
  // `erro: true` no retorno é diferente de "não achou nada": significa
  // que a consulta em si falhou (rede, timeout, erro transitório do
  // Supabase) — nesse caso NÃO dá pra concluir que a conta não tem
  // condomínio/acesso, só que não deu pra checar agora. Achar isso e
  // tratar como "conta órfã" era a causa da tela de "não encontramos
  // seu condomínio" aparecendo pra contas normais em qualquer soluço de
  // rede — ver AccessGate.jsx.
  const fetchAccess = useCallback(async (userId, condominioIdPreferido) => {
    if (!supabase || !userId) {
      return { condominio: null, condominios: [], proPlus: false, member: null, erro: false };
    }

    const [ownedResult, membroResult] = await Promise.all([
      supabase.from("condominios").select("*").eq("owner_id", userId).order("created_at", { ascending: true }),
      supabase.from("membros").select("*, condominios(*)").eq("user_id", userId).maybeSingle(),
    ]);

    if (ownedResult.error) console.error("Erro ao buscar condomínio:", ownedResult.error.message);
    if (ownedResult.data && ownedResult.data.length > 0) {
      const lista = ownedResult.data;
      const escolhido = (condominioIdPreferido && lista.find((c) => c.id === condominioIdPreferido)) || lista[0];

      // Pro+ Multicondomínios é por dono (contas_sindico), não por
      // condomínio — só vale a pena buscar quando há mais de 1, já que
      // com 1 só o seletor nunca aparece de qualquer forma.
      let proPlus = false;
      let proPlusTrialFim = null;
      if (lista.length > 1) {
        const { data: conta } = await supabase
          .from("contas_sindico")
          .select("pro_plus_multicondominios, pro_plus_trial_fim")
          .eq("user_id", userId)
          .maybeSingle();
        proPlus = Boolean(conta?.pro_plus_multicondominios);
        proPlusTrialFim = conta?.pro_plus_trial_fim || null;
      }

      return { condominio: escolhido, condominios: lista, proPlus, proPlusTrialFim, member: null, erro: false };
    }

    // Um síndico/dono nunca tem linha em "membros" — pra ele, essa busca
    // vir vazia é sempre esperado, erro ou não. Então, se foi a busca de
    // "condominios" (a que de fato importaria pro dono) que falhou, não
    // dá pra concluir "não encontrado" só porque "membros" (que nunca
    // acharia nada mesmo) foi bem. Bastava UMA consulta relevante falhar
    // pra essa tela de "conta órfã" aparecer num soluço de rede comum —
    // exigir as DUAS falharem juntas (como antes) deixava passar
    // exatamente esse caso, o mais frequente.
    if (ownedResult.error) {
      return { condominio: null, condominios: [], proPlus: false, member: null, erro: true };
    }

    if (membroResult.error) {
      console.error("Erro ao buscar acesso:", membroResult.error.message);
      return { condominio: null, condominios: [], proPlus: false, member: null, erro: true };
    }

    const membro = membroResult.data;
    if (!membro) return { condominio: null, condominios: [], proPlus: false, member: null, erro: false };

    const { condominios: condo, ...member } = membro;
    return { condominio: condo || null, condominios: [], proPlus: false, member, erro: false };
  }, []);

  const aplicarAcesso = useCallback((userId, resultado) => {
    setCondominio(resultado.condominio);
    setCondominiosDoDono(resultado.condominios);
    setTemProPlusMulticondominios(resultado.proPlus);
    setProPlusTrialFim(resultado.proPlusTrialFim || null);
    setMember(resultado.member);
    setAccessError(resultado.erro);
    if (resultado.condominio && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(chaveCondominioAtivo(userId), resultado.condominio.id);
      } catch {
        // localStorage pode falhar (modo privado, cota cheia) — a troca
        // de condomínio simplesmente não persiste entre sessões, sem
        // quebrar o resto do app.
      }
    }
  }, []);

  function condominioPreferidoSalvo(userId) {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(chaveCondominioAtivo(userId));
    } catch {
      return null;
    }
  }

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
        const resultado = await fetchAccess(session.user.id, condominioPreferidoSalvo(session.user.id));
        if (active) aplicarAcesso(session.user.id, resultado);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const resultado = await fetchAccess(session.user.id, condominioPreferidoSalvo(session.user.id));
        aplicarAcesso(session.user.id, resultado);
        const c = resultado.condominio;
        const m = resultado.member;
        if (event === "SIGNED_IN" && c) {
          const usuarioNome = m?.nome || session.user.user_metadata?.full_name || session.user.email;
          const papel = m?.papel || "sindico";
          supabase
            .from("auditoria")
            .insert({
              condominio_id: c.id,
              usuario_id: session.user.id,
              usuario_nome: usuarioNome,
              papel,
              acao: "login",
              modulo: "sistema",
            })
            .then(({ error }) => {
              if (error) console.error("Erro ao registrar login na auditoria:", error.message);
            });

          // Alerta de login pro síndico — opcional, ele mesmo entrando
          // nunca dispara (só existe `m` pra quem NÃO é dono). A rota
          // confere de novo se está ativado antes de mandar qualquer
          // e-mail (condominios.notificar_acessos_login).
          if (m) {
            fetch("/api/notificar", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({
                condominioId: c.id,
                evento: "acesso_login",
                nome: usuarioNome,
                papel,
              }),
            }).catch((err) => console.error("Erro ao notificar login:", err));
          }
        }
      } else {
        setCondominio(null);
        setCondominiosDoDono([]);
        setTemProPlusMulticondominios(false);
        setProPlusTrialFim(null);
        setMember(null);
        setAccessError(false);
      }
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [fetchAccess, aplicarAcesso]);

  const logout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setCondominio(null);
    setCondominiosDoDono([]);
    setTemProPlusMulticondominios(false);
    setProPlusTrialFim(null);
    setMember(null);
  }, []);

  const refreshCondominio = useCallback(async () => {
    if (!user) return;
    const resultado = await fetchAccess(user.id, condominio?.id || condominioPreferidoSalvo(user.id));
    aplicarAcesso(user.id, resultado);
  }, [user, condominio?.id, fetchAccess, aplicarAcesso]);

  // Troca o condomínio ativo sem precisar de novo login — só vale pro
  // dono (síndico) com mais de 1 condomínio e Pro+ Multicondomínios
  // ativo; ignora silenciosamente qualquer outra tentativa.
  const trocarCondominio = useCallback(
    (condominioId) => {
      const alvo = condominiosDoDono.find((c) => c.id === condominioId);
      if (!alvo || !user) return;
      setCondominio(alvo);
      try {
        window.localStorage.setItem(chaveCondominioAtivo(user.id), alvo.id);
      } catch {
        // ver comentário em aplicarAcesso
      }
    },
    [condominiosDoDono, user]
  );

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

  // The síndico (owner) always has every ação em todo módulo; a delimited
  // member's access is whatever the síndico picked for them in Acessos,
  // stored on their membros row (permissoes: { modulo: [ações] }) — this
  // is just a client-side read for the UI, the real enforcement is the
  // membro_tem_permissao()/membro_tem_modulo() check in every RLS policy.
  const permissoes = useMemo(() => member?.permissoes || {}, [member]);

  const temPermissao = useCallback(
    (modulo, acao) => {
      if (role === "sindico") return true;
      return Boolean(permissoes[modulo]?.includes(acao));
    },
    [role, permissoes]
  );

  const modulosVisiveis = useMemo(() => {
    if (role === "sindico") return ALL_MODULOS;
    return ALL_MODULOS.filter((m) => permissoes[m]?.includes("visualizar"));
  }, [role, permissoes]);

  const value = useMemo(
    () => ({
      user,
      condominio,
      condominiosDoDono,
      temProPlusMulticondominios,
      proPlusTrialFim,
      trocarCondominio,
      member,
      role,
      permissoes,
      modulosVisiveis,
      temPermissao,
      loading,
      isAdmin,
      accessError,
      logout,
      refreshCondominio,
    }),
    [
      user,
      condominio,
      condominiosDoDono,
      temProPlusMulticondominios,
      proPlusTrialFim,
      trocarCondominio,
      member,
      role,
      permissoes,
      modulosVisiveis,
      temPermissao,
      loading,
      isAdmin,
      accessError,
      logout,
      refreshCondominio,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
