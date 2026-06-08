"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClassAction } from "@/app/dashboard/clases/[id]/actions";

interface Props {
  classId: string;
  classTitle: string;
}

export function DeleteClassButton({ classId, classTitle }: Props) {
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const match = input.trim() === classTitle.trim();

  function handleConfirm() {
    if (!match) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteClassAction(classId);
      if (result.ok) {
        router.push("/dashboard");
      } else {
        setError(result.error);
      }
    });
  }

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="h-9 px-4 rounded-[8px] border border-borgona/40 text-borgona text-caption font-medium hover:bg-borgona/5 transition-colors"
      >
        Eliminar clase
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-body text-ink-soft">
        Escribe{" "}
        <span className="text-mono text-ink font-medium">{classTitle}</span>{" "}
        para confirmar. Esta acción no se puede deshacer.
      </p>
      <input
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={classTitle}
        className="w-full h-10 px-3 rounded-[8px] border-subtle bg-page text-body text-ink placeholder:text-ink-mute focus:outline-none focus:ring-1 focus:ring-borgona/40"
      />
      {error && <p className="text-mono text-borgona text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={!match || isPending}
          className="h-9 px-4 rounded-[8px] bg-borgona text-white text-caption font-medium hover:bg-borgona/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
        <button
          onClick={() => { setStep("idle"); setInput(""); setError(null); }}
          disabled={isPending}
          className="h-9 px-4 rounded-[8px] text-caption text-ink-mute hover:text-ink transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
