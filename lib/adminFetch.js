"use client";

import { supabase } from "@/lib/supabase";

// Client helper shared by the admin dashboard components: attaches the
// current Supabase session's access token so /api/admin/* routes can
// verify the caller is the platform owner (see lib/adminAuth.js).
export async function authedFetch(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
  });
}
