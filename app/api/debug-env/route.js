import { NextResponse } from "next/server";

// Diagnostic-only: reports whether each expected env var is SET (true/false),
// never the actual values. Gated behind ALLOW_TEST_SIGNUP so it's disabled
// by default once real customers are onboarded. Use this to figure out
// exactly which variable is missing/misnamed on Vercel, instead of
// guessing from a generic "not configured" error.
export async function GET() {
  if (process.env.ALLOW_TEST_SIGNUP !== "true") {
    return NextResponse.json({ error: "Desabilitado (ALLOW_TEST_SIGNUP != true)." }, { status: 403 });
  }

  const check = (name) => ({
    set: Boolean(process.env[name]),
    length: process.env[name]?.length || 0,
  });

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: check("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: check("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: check("SUPABASE_SERVICE_ROLE_KEY"),
    ADMIN_EMAILS: check("ADMIN_EMAILS"),
    NEXT_PUBLIC_ADMIN_EMAILS: check("NEXT_PUBLIC_ADMIN_EMAILS"),
    ALLOW_TEST_SIGNUP: check("ALLOW_TEST_SIGNUP"),
    NEXT_PUBLIC_TEST_MODE: check("NEXT_PUBLIC_TEST_MODE"),
    STRIPE_SECRET_KEY: check("STRIPE_SECRET_KEY"),
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY: check("NEXT_PUBLIC_STRIPE_PUBLIC_KEY"),
  });
}
