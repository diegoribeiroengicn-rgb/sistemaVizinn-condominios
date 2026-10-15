"use client";

import { useEffect, useRef, useState } from "react";

// Tirar foto direto pela câmera (webcam do notebook ou câmera do
// celular) sem passos extras — getUserMedia abre a câmera nativa do
// aparelho na hora, sem precisar instalar nada nem sair do app/navegador.
// Só a câmera, de propósito (sem opção de escolher um arquivo já
// existente) — quando ela não está disponível (permissão negada, sem
// suporte, sem HTTPS), mostra o erro e segue sem foto; foto é sempre
// opcional, nunca trava o cadastro.
export default function CapturaFoto({ onCapturar, fotoAtualNome, facingMode = "environment" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [capturando, setCapturando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [pronta, setPronta] = useState(false);
  const [erro, setErro] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    return () => pararCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Só conecta o stream no <video> depois que ele existe de verdade no
  // DOM (o elemento só nasce quando `capturando` vira true e o React
  // re-renderiza) — um setTimeout(0) pra isso é frágil e falhava às
  // vezes (câmera "abria" mas a imagem nunca aparecia e capturar dava
  // foto preta/vazia). useEffect com `capturando` na dependência garante
  // a ordem certa sempre.
  useEffect(() => {
    if (!capturando || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    // iOS Safari exige um play() explícito mesmo com autoPlay — ignora o
    // erro se o navegador recusar (autoplay bloqueado), o vídeo começa
    // assim que o usuário interagir de novo.
    video.play().catch(() => {});
  }, [capturando]);

  function pararCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCapturando(false);
    setPronta(false);
  }

  async function abrirCamera() {
    setErro("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não permite abrir a câmera aqui. Escolha um arquivo abaixo.");
      return;
    }
    setAbrindo(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
      streamRef.current = stream;
      setCapturando(true);
    } catch (err) {
      const negada = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      setErro(
        negada
          ? "Permissão da câmera negada. Verifique as permissões do navegador/app e tente de novo, ou escolha um arquivo abaixo."
          : "Não consegui acessar a câmera agora. Você pode escolher um arquivo abaixo."
      );
    } finally {
      setAbrindo(false);
    }
  }

  function tirarFoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const arquivo = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        setPreviewUrl(URL.createObjectURL(blob));
        onCapturar(arquivo);
        pararCamera();
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="space-y-2">
      {capturando ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setPronta(true)}
            className="w-full max-w-xs rounded-lg border border-navy-200 bg-navy-900"
          />
          <div className="flex gap-2">
            <button type="button" onClick={tirarFoto} disabled={!pronta} className="btn-primary text-sm disabled:opacity-50">
              {pronta ? "📷 Capturar" : "Carregando câmera..."}
            </button>
            <button type="button" onClick={pararCamera} className="text-sm font-semibold text-navy-500 hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={abrirCamera} disabled={abrindo} className="btn-secondary text-sm disabled:opacity-50">
          {abrindo ? "Abrindo câmera..." : "📷 Tirar foto pela câmera"}
        </button>
      )}
      {erro && <p className="text-xs text-amber-700">{erro}</p>}
      {previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
      ) : (
        fotoAtualNome && <p className="text-xs text-navy-400">Foto atual mantida — escolha outra pra trocar.</p>
      )}
    </div>
  );
}
