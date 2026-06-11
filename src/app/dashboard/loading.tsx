export default function DashboardLoading() {
  return (
    <div className="flex-1 flex items-center justify-center py-24" role="status" aria-label="Cargando">
      <div className="flex items-center gap-3 text-ink-mute">
        <span className="w-4 h-4 rounded-full border-2 border-ink-mute/30 border-t-ink-mute animate-spin" />
        <span className="text-caption">Cargando…</span>
      </div>
    </div>
  );
}
