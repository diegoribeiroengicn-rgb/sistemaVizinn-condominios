"use client";

import { supabase } from "@/lib/supabase";

// Igual lib/adminFetch.js, mas pras rotas /api/vendedor/* — mesmo
// motivo do cache: "no-store" pra nunca servir resposta velha do
// cache do navegador.
export async function vendedorFetch(path, options = {}) {
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
