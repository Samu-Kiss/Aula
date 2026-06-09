"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
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
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
}
