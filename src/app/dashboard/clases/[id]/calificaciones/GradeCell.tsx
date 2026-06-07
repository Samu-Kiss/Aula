"use client";

interface Props {
  score: number | null;
  notes: string | null;
  maxScore: number;
  autoScore: number | null;
  autoMax: number | null;
  isSelected: boolean;
  onSelect: () => void;
}

export function GradeCell({ score, notes, maxScore, autoScore, autoMax, isSelected, onSelect }: Props) {
  const effectiveScore = score !== null ? score : autoScore;
  const effectiveMax   = score !== null ? maxScore : (autoMax ?? maxScore);
  const isAuto = score === null && autoScore !== null;
  const pct =
    effectiveScore != null && effectiveMax > 0
      ? Math.round((effectiveScore / effectiveMax) * 1000) / 10
      : null;

  return (
    <button
      onClick={onSelect}
      title={notes ?? undefined}
      className={`group w-full min-w-[80px] text-center rounded-[6px] py-1.5 px-2 transition-colors ${
        isSelected ? "bg-indigo/10 ring-1 ring-indigo/40" : "hover:bg-surface-alt"
      }`}
    >
      {effectiveScore == null ? (
        <span className="text-mono text-ink-mute group-hover:text-ink transition-colors">—</span>
      ) : (
        <div className="space-y-0.5">
          <p className="text-body font-semibold tabular-nums text-ink leading-none">{pct}%</p>
          <p className="text-mono text-ink-mute leading-none">{effectiveScore}/{effectiveMax}</p>
          {isAuto && <p className="text-[10px] text-ink-mute opacity-50 leading-none">quiz</p>}
          {score !== null && notes && (
            <p className="text-mono text-ink-mute opacity-60 truncate max-w-[90px] mx-auto leading-none">{notes}</p>
          )}
        </div>
      )}
    </button>
  );
}
