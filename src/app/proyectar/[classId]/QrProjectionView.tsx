"use client";

import { QRCodeSVG } from "qrcode.react";

interface Props {
  url: string;
  accentHex: string;
  classTitle: string;
}

export function QrProjectionView({ url, accentHex, classTitle }: Props) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center select-none">
      <button
        onClick={() => window.close()}
        className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full text-ink-mute hover:text-ink hover:bg-surface-alt transition-colors text-[22px] leading-none"
        aria-label="Cerrar"
      >
        ×
      </button>

      <div className="flex flex-col items-center gap-8">
        <div className="bg-white p-5 rounded-[20px] shadow-lg border border-[rgba(0,0,0,0.06)]">
          <QRCodeSVG
            value={url}
            size={380}
            fgColor={accentHex}
            bgColor="#ffffff"
            level="M"
          />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-[36px] font-black leading-none" style={{ color: accentHex }}>
            {classTitle}
          </h1>
          <p className="text-mono text-ink-mute text-[15px]">{url}</p>
        </div>
      </div>
    </div>
  );
}
