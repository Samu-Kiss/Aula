import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClipboardCheck } from "lucide-react";

type NotifPayload = {
  student_name?: string;
  student_email?: string;
  content_title?: string;
  class_title?: string;
  class_id?: string;
  attempt_id?: string;
  score?: number;
  max_score?: number;
  has_pending_manual?: boolean;
};

type Notif = {
  id: string;
  type: string;
  payload: NotifPayload;
  read_at: string | null;
  created_at: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: rows } = await supabase
    .from("professor_notifications")
    .select("id, type, payload, read_at, created_at")
    .eq("professor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const notifications = (rows ?? []) as Notif[];
  const hasUnread = notifications.some((n) => !n.read_at);

  if (hasUnread) {
    await supabase
      .from("professor_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("professor_id", user.id)
      .is("read_at", null);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <p className="text-eyebrow text-ink-mute mb-2">Dashboard</p>
        <h1 className="text-hero-dashboard font-black text-ink leading-none">Notificaciones</h1>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-body text-ink-soft">Sin notificaciones por ahora.</p>
          <p className="text-mono text-ink-mute mt-1">
            Aparecerán aquí cuando los estudiantes entreguen evaluaciones.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => (
            <NotifRow key={n.id} n={n} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotifRow({ n }: { n: Notif }) {
  const p = n.payload;
  const isUnread = !n.read_at;
  const pct =
    p.score != null && p.max_score != null && p.max_score > 0
      ? Math.round((p.score / p.max_score) * 1000) / 10
      : null;

  const href =
    p.class_id && p.attempt_id
      ? `/dashboard/clases/${p.class_id}/intentos/${p.attempt_id}`
      : null;

  const inner = (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-[10px] border transition-colors ${
        isUnread
          ? "bg-indigo/5 border-indigo/15"
          : "bg-surface border-subtle"
      } ${href ? "hover:border-ink/20" : ""}`}
    >
      <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-[8px] flex items-center justify-center ${
        isUnread ? "bg-indigo/10 text-indigo" : "bg-surface-alt text-ink-mute"
      }`}>
        <ClipboardCheck size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body text-ink leading-snug">
          <span className="font-medium">
            {p.student_name ?? p.student_email ?? "Estudiante"}
          </span>{" "}
          entregó{" "}
          <span className="font-medium">{p.content_title ?? "una evaluación"}</span>
          {p.class_title ? ` en ${p.class_title}` : ""}
        </p>
        <p className="text-mono text-ink-mute mt-0.5 flex items-center gap-2 flex-wrap">
          {pct !== null && (
            <span>{pct}% &middot; {p.score}/{p.max_score} pts</span>
          )}
          {p.has_pending_manual && (
            <span className="text-ambar">Requiere revisión manual</span>
          )}
          <span>{relativeTime(n.created_at)}</span>
        </p>
      </div>
      {href && (
        <span className="shrink-0 text-caption text-indigo mt-0.5">Ver →</span>
      )}
    </div>
  );

  return (
    <div>
      {href ? <Link href={href}>{inner}</Link> : inner}
    </div>
  );
}
