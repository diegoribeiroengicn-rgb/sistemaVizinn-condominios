import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { getPlan } from "@/lib/plans";

// Platform-owner-only: aggregate view across every tenant (condominio).
// Reads via the service role client, so it bypasses RLS by design —
// access is gated entirely by requireAdmin() below.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: condominios, error } = await supabaseAdmin
    .from("condominios")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("admin/overview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: contasSindico } = await supabaseAdmin
    .from("contas_sindico")
    .select("user_id, pro_plus_multicondominios");
  const proPlusPorDono = new Set(
    (contasSindico || []).filter((c) => c.pro_plus_multicondominios).map((c) => c.user_id)
  );
  for (const c of condominios) {
    c.pro_plus_multicondominios = proPlusPorDono.has(c.owner_id);
  }

  let mrr = 0;
  let projectedMrr = 0;
  let activeCount = 0;
  let trialCount = 0;
  let canceledCount = 0;
  let suspendedCount = 0;
  let promiseCount = 0;
  let courtesyCount = 0;
  const planCounts = {};
  const signupsByDay = {};

  for (const c of condominios) {
    const plan = getPlan(c.plano);
    planCounts[plan.id] = (planCounts[plan.id] || 0) + 1;

    if (c.status === "active") {
      mrr += plan.price;
      projectedMrr += plan.price;
      activeCount += 1;
    } else if (c.status === "trialing") {
      projectedMrr += plan.price;
      trialCount += 1;
    } else if (c.status === "promessa") {
      projectedMrr += plan.price;
      promiseCount += 1;
    } else if (c.status === "cortesia") {
      courtesyCount += 1;
    } else if (c.status === "suspended") {
      suspendedCount += 1;
    } else if (["canceled", "unpaid", "incomplete_expired"].includes(c.status)) {
      canceledCount += 1;
    }

    const day = (c.created_at || "").slice(0, 10);
    if (day) signupsByDay[day] = (signupsByDay[day] || 0) + 1;
  }

  const totalUnidadesLimite = condominios.reduce((sum, c) => sum + (c.unidades_limite || 0), 0);
  const totalUnidadesAtivas = condominios.reduce((sum, c) => sum + (c.unidades_ativas || 0), 0);

  return NextResponse.json({
    totalCondominios: condominios.length,
    mrr,
    projectedMrr,
    activeCount,
    trialCount,
    canceledCount,
    suspendedCount,
    promiseCount,
    courtesyCount,
    planCounts,
    totalUnidadesLimite,
    totalUnidadesAtivas,
    signupsByDay,
    condominios,
  });
}
