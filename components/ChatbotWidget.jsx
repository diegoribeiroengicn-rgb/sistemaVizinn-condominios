"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { ehPerguntaDeContinuacao } from "@/lib/buscaConhecimento";

const SAUDACAO = {
  id: "saudacao",
  from: "bot",
  texto: "Oi! Sou o assistente do Vizinn. Pergunta o que quiser, tipo \"como cadastro um visitante\".",
};

// Chatbot Nível 1 (FAQ + manual conversacional, sem IA) — busca por
// palavra-chave na base de conhecimento (/api/chat/perguntar) e, quando
// não encontra ou a pessoa não ficou satisfeita, encaminha pro Fale
// Conosco (reaproveita /api/contato, sem WhatsApp/protocolo por
// enquanto). Funciona logado (contexto por papel) ou como visitante.
export default function ChatbotWidget() {
  const { user, member } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState([SAUDACAO]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mostrarFormEscalar, setMostrarFormEscalar] = useState(false);
  const [nomeEscalar, setNomeEscalar] = useState("");
  const [emailEscalar, setEmailEscalar] = useState("");
  const [escalando, setEscalando] = useState(false);
  const [escaladoOk, setEscaladoOk] = useState(false);
  const idRef = useRef(1);
  // Não é memória de conversa de verdade — só guarda o último item
  // encontrado pra dar sentido a perguntas de continuação tipo "e
  // depois?" (ver ehPerguntaDeContinuacao em lib/buscaConhecimento.js).
  const ultimoItemRef = useRef(null);

  function proximoId() {
    idRef.current += 1;
    return idRef.current;
  }

  function push(msg) {
    setMensagens((m) => [...m, { id: proximoId(), ...msg }]);
  }

  async function pegarToken() {
    if (!user || !isSupabaseConfigured) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  async function enviarPergunta(e) {
    e.preventDefault();
    const pergunta = input.trim();
    if (!pergunta || enviando) return;
    push({ from: "user", texto: pergunta });
    setInput("");
    setEnviando(true);
    try {
      const token = await pegarToken();
      const res = await fetch("/api/chat/perguntar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pergunta }),
      });
      const data = await res.json();
      if (data.encontrado) {
        push({ from: "bot", texto: data.respostaCurta, passoAPasso: data.passoAPasso });
        ultimoItemRef.current = { passoAPasso: data.passoAPasso || null, jaMostrado: false };
      } else if (ehPerguntaDeContinuacao(pergunta) && ultimoItemRef.current) {
        if (ultimoItemRef.current.passoAPasso && !ultimoItemRef.current.jaMostrado) {
          push({ from: "bot", texto: ultimoItemRef.current.passoAPasso });
          ultimoItemRef.current.jaMostrado = true;
        } else {
          push({
            from: "bot",
            texto: "Isso é tudo que eu tenho sobre esse assunto. Posso ajudar com mais alguma coisa?",
          });
        }
      } else {
        push({
          from: "bot",
          texto:
            "Não tenho informação suficiente para responder isso com segurança. Posso ajudar com as funcionalidades e procedimentos disponíveis no Vizinn.",
        });
      }
    } catch {
      push({ from: "bot", texto: "Deu um problema aqui pra buscar a resposta. Tenta de novo em instantes?" });
    } finally {
      setEnviando(false);
    }
  }

  function verPassoAPasso(msgId, passoAPasso) {
    setMensagens((m) => m.map((msg) => (msg.id === msgId ? { ...msg, passoAPasso: undefined } : msg)));
    push({ from: "bot", texto: passoAPasso });
  }

  async function escalar(e) {
    e?.preventDefault();
    const nome = user ? member?.nome || user.user_metadata?.full_name || user.email : nomeEscalar.trim();
    const email = user ? user.email : emailEscalar.trim();
    if (!nome || !email) {
      setMostrarFormEscalar(true);
      return;
    }

    setEscalando(true);
    try {
      const resumo = mensagens
        .slice(-10)
        .map((m) => `${m.from === "user" ? "Pergunta" : "Assistente"}: ${m.texto}`)
        .join("\n");

      const res = await fetch("/api/contato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          mensagem: `Mensagem vinda do chatbot do Vizinn (dúvida não resolvida automaticamente).\n\n${resumo}`,
        }),
      });
      if (!res.ok) throw new Error();
      setEscaladoOk(true);
      setMostrarFormEscalar(false);
      push({ from: "bot", texto: "Encaminhado! Vamos te responder por e-mail em breve." });
    } catch {
      push({ from: "bot", texto: "Não consegui encaminhar agora. Tenta de novo em instantes?" });
    } finally {
      setEscalando(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {aberto && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between bg-midnight px-4 py-3">
            <span className="font-display text-sm font-bold text-white">Assistente Vizinn</span>
            <button onClick={() => setAberto(false)} className="text-cream-100 hover:text-white" aria-label="Fechar">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {mensagens.map((msg) => (
              <div key={msg.id} className={msg.from === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                    msg.from === "user" ? "bg-coral text-white" : "bg-navy-50 text-navy-800"
                  }`}
                >
                  {msg.texto}
                  {msg.passoAPasso && (
                    <button
                      onClick={() => verPassoAPasso(msg.id, msg.passoAPasso)}
                      className="mt-2 block text-xs font-semibold text-coral hover:underline"
                    >
                      Ver passo a passo →
                    </button>
                  )}
                </div>
              </div>
            ))}

            {mostrarFormEscalar && !escaladoOk && (
              <form onSubmit={escalar} className="space-y-2 rounded-lg border border-navy-100 p-2">
                <input
                  className="input-field text-sm"
                  placeholder="Seu nome"
                  value={nomeEscalar}
                  onChange={(e) => setNomeEscalar(e.target.value)}
                  required
                />
                <input
                  className="input-field text-sm"
                  type="email"
                  placeholder="Seu e-mail"
                  value={emailEscalar}
                  onChange={(e) => setEmailEscalar(e.target.value)}
                  required
                />
                <button type="submit" disabled={escalando} className="btn-primary w-full text-sm">
                  {escalando ? "Enviando..." : "Enviar pro atendimento"}
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-navy-100 p-2">
            {!escaladoOk && (
              <button
                onClick={() => escalar()}
                disabled={escalando}
                className="mb-2 w-full text-center text-xs font-semibold text-navy-500 hover:underline"
              >
                Não resolveu? Falar com atendimento
              </button>
            )}
            <form onSubmit={enviarPergunta} className="flex gap-2">
              <input
                className="input-field flex-1 text-sm"
                placeholder="Digite sua dúvida..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="submit" disabled={enviando} className="btn-primary text-sm">
                {enviando ? "..." : "Enviar"}
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setAberto((a) => !a)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-coral text-2xl text-white shadow-lg transition hover:bg-coral-600"
        aria-label="Abrir assistente"
      >
        {aberto ? "✕" : "💬"}
      </button>
    </div>
  );
}
