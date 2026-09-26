"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Botão de "instalar o app" na Landing Page — usa o evento nativo do
// Chrome/Edge/Android (beforeinstallprompt) quando disponível. No
// iPhone (Safari) esse evento não existe — não tem como abrir o
// instalador via clique, por limitação do próprio iOS — então mostra
// o passo a passo manual (Compartilhar > Adicionar à Tela de Início)
// em vez de um botão que não funcionaria.
export default function InstalarApp() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [instalado, setInstalado] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [mostrarPassoAPasso, setMostrarPassoAPasso] = useState(false);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream);

    function aoFicarInstalavel(e) {
      e.preventDefault();
      setPromptEvent(e);
    }
    function aoInstalar() {
      setInstalado(true);
      setPromptEvent(null);
    }
    window.addEventListener("beforeinstallprompt", aoFicarInstalavel);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoFicarInstalavel);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  async function handleInstalar() {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }

  if (instalado) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" id="app">
      <div className="card mx-auto flex max-w-3xl flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <Image src="/brand/vizinn-mark.png" alt="Vizinn" width={72} height={72} className="flex-none rounded-2xl" />
        <div className="flex-1">
          <h2 className="font-display text-xl font-bold text-navy-900">Leve o Vizinn no bolso</h2>
          <p className="mt-1 text-sm text-navy-600">
            Instale o app no seu celular — sem loja, sem espaço ocupado, direto do navegador.
            Acesso rápido a chamados, avisos e financeiro de onde você estiver.
          </p>
        </div>
        <div className="flex-none">
          {promptEvent ? (
            <button onClick={handleInstalar} className="btn-primary whitespace-nowrap">
              ⬇ Baixar app
            </button>
          ) : isIOS ? (
            <button
              onClick={() => setMostrarPassoAPasso((v) => !v)}
              className="btn-secondary whitespace-nowrap"
            >
              Como instalar no iPhone
            </button>
          ) : (
            <button
              onClick={() => setMostrarPassoAPasso((v) => !v)}
              className="btn-secondary whitespace-nowrap"
            >
              Como instalar
            </button>
          )}
        </div>
      </div>

      {mostrarPassoAPasso && (
        <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-navy-100 bg-navy-50/50 p-4 text-left text-sm text-navy-600">
          {isIOS ? (
            <ol className="list-inside list-decimal space-y-1">
              <li>Abra este site no Safari (não funciona pelo app do Instagram/WhatsApp).</li>
              <li>
                Toque no ícone de compartilhar <span className="font-semibold">⬆️</span> na barra do navegador.
              </li>
              <li>Escolha &ldquo;Adicionar à Tela de Início&rdquo;.</li>
              <li>Pronto — o ícone do Vizinn aparece na sua tela como um app.</li>
            </ol>
          ) : (
            <p>
              Se o botão &ldquo;Baixar app&rdquo; não apareceu, seu navegador já deve ter essa opção no menu (⋮) —
              procure por &ldquo;Instalar app&rdquo; ou &ldquo;Adicionar à tela inicial&rdquo;.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
