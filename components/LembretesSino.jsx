"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { calcularStatusLembrete } from "@/lib/lembretes";
import { IconSino, IconX } from "@/components/icons";

const POPUP_DISMISS_KEY_PREFIX = "aquihabitto-lembretes-popup-dispensado-";

function formatarDataBr(isoOuNulo) {
  if (!isoOuNulo) return "";
  const [ano, mes, dia] = isoOuNulo.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Sino de notificações do dashboard — não cria um mecanismo paralelo: lê
// a mesma tabela `lembretes` que a página central usa. Fechar o pop-up
// só marca "não mostrar de novo hoje" no localStorage deste navegador;
// nunca conclui, cancela nem exclui o lembrete — ele continua disponível
// na lista central e volta a aparecer no pop-up no dia seguinte.
export default function LembretesSino() {
  const { condominio, temPermissao } = useAuth();
  const [lembretes, setLembretes] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [popupDispensado, setPopupDispensado] = useState(true);

  const podeVer = temPermissao("lembretes", "visualizar");

  useEffect(() => {
    if (!condominio?.id || !podeVer) return;
    let ativo = true;
    supabase
      .from("lembretes")
      .select("id, titulo, data_alerta, status, prioridade, origem")
      .eq("condominio_id", condominio.id)
      .eq("status", "pendente")
      .not("data_alerta", "is", null)
      .order("data_alerta", { ascending: true })
      .then(({ data, error }) => {
        if (!ativo || error) return;
        setLembretes(data || []);
      });
    return () => {
      ativo = false;
    };
  }, [condominio?.id, podeVer]);

  const urgentes = useMemo(
    () =>
      lembretes
        .map((l) => ({ ...l, statusInfo: calcularStatusLembrete(l.data_alerta, l.status) }))
        .filter((l) => l.statusInfo?.nivel === "vermelho" || l.statusInfo?.nivel === "amarelo"),
    [lembretes]
  );

  useEffect(() => {
    if (!condominio?.id) return;
    const hojeStr = new Date().toISOString().slice(0, 10);
    try {
      const dispensadoHoje = window.localStorage.getItem(`${POPUP_DISMISS_KEY_PREFIX}${condominio.id}`) === hojeStr;
      setPopupDispensado(dispensadoHoje);
    } catch {
      setPopupDispensado(false);
    }
  }, [condominio?.id]);

  function dispensarPopup() {
    const hojeStr = new Date().toISOString().slice(0, 10);
    try {
      window.localStorage.setItem(`${POPUP_DISMISS_KEY_PREFIX}${condominio.id}`, hojeStr);
    } catch {
      // sem localStorage, sem problema — só não evita reaparecer
    }
    setPopupDispensado(true);
  }

  if (!podeVer) return null;

  return (
    <div className="fixed right-16 top-3 z-40 lg:right-6 lg:top-4">
      <div className="relative">
        <button
          onClick={() => setAberto((v) => !v)}
          aria-label="Notificações de lembretes"
          className="relative rounded-full bg-white p-2 text-navy-700 shadow-md transition hover:bg-navy-50"
        >
          <IconSino className="h-5 w-5" />
          {urgentes.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
              {urgentes.length}
            </span>
          )}
        </button>

        {aberto && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
            <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-navy-100 bg-white p-3 shadow-lg">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-navy-900">Lembretes</p>
                <Link href="/dashboard/lembretes" onClick={() => setAberto(false)} className="text-xs font-semibold text-navy-500 hover:underline">
                  Ver todos
                </Link>
              </div>
              {lembretes.length === 0 ? (
                <p className="mt-2 text-xs text-navy-400">Nenhum lembrete pendente.</p>
              ) : (
                <div className="mt-2 max-h-80 space-y-2 overflow-y-auto">
                  {lembretes.slice(0, 8).map((l) => {
                    const statusInfo = calcularStatusLembrete(l.data_alerta, l.status);
                    return (
                      <Link
                        key={l.id}
                        href="/dashboard/lembretes"
                        onClick={() => setAberto(false)}
                        className="block rounded-lg border border-navy-50 px-2 py-1.5 text-xs hover:bg-navy-50"
                      >
                        <p className="font-medium text-navy-800">{l.titulo}</p>
                        <p className="mt-0.5 text-navy-400">
                          {statusInfo && `${statusInfo.emoji} ${statusInfo.label} · `}
                          {formatarDataBr(l.data_alerta)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!popupDispensado && urgentes.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-coral-100 bg-white p-4 shadow-xl sm:right-6">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-navy-900">
              {urgentes.length === 1 ? "Você tem 1 lembrete que precisa de atenção" : `Você tem ${urgentes.length} lembretes que precisam de atenção`}
            </p>
            <button onClick={dispensarPopup} aria-label="Fechar" className="flex-none text-navy-400 hover:text-navy-700">
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {urgentes.slice(0, 3).map((l) => (
              <li key={l.id} className="text-xs text-navy-600">
                {l.statusInfo.emoji} {l.titulo}
              </li>
            ))}
          </ul>
          <Link href="/dashboard/lembretes" onClick={dispensarPopup} className="mt-3 inline-block text-xs font-semibold text-coral-700 hover:underline">
            Ver lembretes →
          </Link>
        </div>
      )}
    </div>
  );
}
