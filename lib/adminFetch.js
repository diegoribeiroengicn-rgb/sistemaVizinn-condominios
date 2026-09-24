"use client";

import { supabase } from "@/lib/supabase";

// Client helper shared by the admin dashboard components: attaches the
// current Supabase session's access token so /api/admin/* routes can
// verify the caller is the platform owner (see lib/adminAuth.js).
// `cache: "no-store"` é essencial aqui: sem isso, o navegador pode
// servir do cache HTTP uma resposta antiga pra uma URL de GET já vista
// antes (ex: a listagem sem busca, `?page=1&pageSize=20`) mesmo depois
// de o dado mudar no banco — só uma URL nova (com um `q=` diferente,
// por exemplo) força ir buscar de novo no servidor.
export async function authedFetch(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return fetch(path, {
    cache: "no-store",
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
  });
}
