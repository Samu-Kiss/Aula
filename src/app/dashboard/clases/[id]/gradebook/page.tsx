import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

// Legacy route — merged into /calificaciones?tab=quices
export default async function GradebookRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/clases/${id}/calificaciones?tab=quices`);
}
