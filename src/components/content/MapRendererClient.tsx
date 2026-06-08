"use client";

import dynamic from "next/dynamic";

const MapRendererLazy = dynamic(
  () => import("./MapRenderer").then((m) => m.MapRenderer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] rounded-[12px] bg-surface-alt animate-pulse" />
    ),
  }
);

export function MapRendererClient(props: {
  body: Record<string, unknown> | null;
  accent?: string;
}) {
  return <MapRendererLazy {...props} />;
}
