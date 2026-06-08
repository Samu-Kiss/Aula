"use client";

import { QRCodeSVG } from "qrcode.react";
import { useRef, useState, useEffect } from "react";
import { Lockup } from "@/components/Lockup";
import type { Accent } from "@/lib/schemas/shared";

interface Props {
  url: string;
  accentHex: string;
  classId: string;
  classTitle: string;
  accent: Accent;
  splitAt?: number | null;
}

export function ClassQrCode({ url, accentHex, classId: _classId, classTitle, accent, splitAt }: Props) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [projecting, setProjecting] = useState(false);

  useEffect(() => {
    if (!projecting) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProjecting(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [projecting]);

  function handleDownload() {
    const div = qrRef.current;
    if (!div) return;
    const svg = div.querySelector("svg");
    if (!svg) return;

    const cloned = svg.cloneNode(true) as SVGElement;
    const size = 512;
    cloned.setAttribute("width", String(size));
    cloned.setAttribute("height", String(size));

    const svgData = new XMLSerializer().serializeToString(cloned);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(blobUrl);
      const link = document.createElement("a");
      link.download = "qr-clase.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = blobUrl;
  }

  return (
    <>
      <div className="flex flex-col items-start gap-4">
        <div ref={qrRef} className="bg-white p-4 rounded-[12px] border border-subtle inline-block">
          <QRCodeSVG
            value={url}
            size={160}
            fgColor={accentHex}
            bgColor="#ffffff"
            level="M"
          />
        </div>
        <p className="text-mono text-ink-mute text-[12px]">{url}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setProjecting(true)}
            className="px-4 py-2 bg-ink text-surface rounded-[8px] text-caption font-bold hover:bg-ink/90 transition-colors"
          >
            Proyectar
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 border border-subtle rounded-[8px] text-caption font-medium text-ink hover:bg-surface-alt transition-colors"
          >
            Descargar PNG
          </button>
        </div>
      </div>

      {/* Projection modal */}
      {projecting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setProjecting(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Card */}
          <div
            className="relative bg-white rounded-[24px] p-10 flex flex-col items-center gap-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setProjecting(false)}
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-ink-mute hover:text-ink hover:bg-surface-alt transition-colors text-[22px] leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>

            <div className="bg-white p-5 rounded-[16px] border border-[rgba(0,0,0,0.06)]">
              <QRCodeSVG
                value={url}
                size={340}
                fgColor={accentHex}
                bgColor="#ffffff"
                level="M"
              />
            </div>

            <div className="text-center space-y-2">
              <Lockup title={classTitle} accent={accent} splitAt={splitAt} className="text-[28px]" plain />
              <p className="text-mono text-ink-mute text-[13px]">{url}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
