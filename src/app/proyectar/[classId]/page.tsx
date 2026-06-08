import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { ACCENT_HEX } from "@/lib/accentColors";
import { QrProjectionView } from "./QrProjectionView";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function ProyectarPage({ params }: Props) {
  const { classId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cls = await classService(supabase).getById(classId);
  if (!cls) notFound();

  const url = `${APP_URL}/c/${cls.slug}`;
  const hex = ACCENT_HEX[cls.accent] ?? "#4C51BF";

  return <QrProjectionView url={url} accentHex={hex} classTitle={cls.title} />;
}
