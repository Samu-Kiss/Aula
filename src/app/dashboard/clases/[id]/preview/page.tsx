import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PreviewPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getById(id);
  if (!cls) notFound();
  redirect(`/c/${cls.slug}`);
}
