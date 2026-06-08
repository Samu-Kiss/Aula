"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateClassAction } from "@/app/dashboard/clases/[id]/actions";

export function DuplicateClassButton({ classId }: { classId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await duplicateClassAction(classId);
      if (result.ok) {
        router.push(`/dashboard/clases/${result.id}`);
      }
    });
  }

  return (
    <button
      onClick={handleDuplicate}
      disabled={isPending}
      title="Duplicar clase"
      className="p-1.5 rounded-[6px] bg-surface/90 text-ink-mute hover:text-ink hover:bg-surface transition-colors disabled:opacity-50 shadow-sm border border-[rgba(0,0,0,0.08)]"
    >
      {isPending ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="animate-spin">
          <circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="8" height="8" rx="1.5" />
          <path d="M2 10V2h8" />
        </svg>
      )}
    </button>
  );
}
