"use client";

import dynamic from "next/dynamic";

const MapEditorLazy = dynamic(
  () => import("./MapEditorInner").then((m) => m.MapEditorInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] bg-surface rounded-[12px] border border-subtle animate-pulse" />
    ),
  }
);

export function MapEditorClient(props: {
  contentId: string;
  classId: string;
  initialDraft: Record<string, unknown>;
  isPublished: boolean;
  accent?: string | null;
}) {
  return <MapEditorLazy {...props} />;
}
