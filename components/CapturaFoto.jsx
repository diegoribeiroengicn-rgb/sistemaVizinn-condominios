"use client";

import { useEffect, useRef, useState } from "react";

// Tirar foto direto pela câmera (webcam do notebook ou câmera do
// celular) sem passos extras — getUserMedia abre a câmera nativa do
// aparelho na hora, sem precisar instalar nada nem sair do navegador.
// Quando a câmera não está disponível (permissão negada, sem suporte),
// cai automaticamente pra escolher um arquivo já existente — nunca
// trava o cadastro por causa disso (foto é sempre opcional).
export default function CapturaFoto({ onCapturar, fotoAtualNome, facingMode = "environment" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [capturando, setCapturando] = useState(false);
  const [erro, setErro] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    return () => pararCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pararCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCapturando(false);
  }

  async function abrirCamera() {
    setErro("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = stream;
      setCapturando(true);
      // O <video> só existe no DOM depois do setCapturando re-renderizar —
      // conecta o stream no próximo tick.
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setErro("Não consegui acessar a câmera. Você pode escolher um arquivo abaixo.");
    }
  }

  function tirarFoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const arquivo = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
      setPreviewUrl(URL.createObjectURL(blob));
      onCapturar(arquivo);
      pararCamera();
    }, "image/jpeg", 0.9);
  }

  function handleArquivo(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setPreviewUrl(URL.createObjectURL(arquivo));
    onCapturar(arquivo);
  }

  return (
    <div className="space-y-2">
      {capturando ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-xs rounded-lg border border-navy-200" />
          <div className="flex gap-2">
            <button type="button" onClick={tirarFoto} className="btn-primary text-sm">
              📷 Capturar
            </button>
            <button type="button" onClick={pararCamera} className="text-sm font-semibold text-navy-500 hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={abrirCamera} className="btn-secondary text-sm">
            📷 Tirar foto pela câmera
          </button>
          <span className="text-xs text-navy-400">ou</span>
          <input type="file" accept="image/*" capture={facingMode} onChange={handleArquivo} className="text-sm text-navy-600" />
        </div>
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
