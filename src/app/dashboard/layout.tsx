import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let unreadNotifications = 0;
  if (user) {
    const { count } = await supabase
      .from("professor_notifications")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", user.id)
      .is("read_at", null);
    unreadNotifications = count ?? 0;
  }

  return (
    <div className="flex flex-col h-screen bg-page">
      <Header email={user?.email ?? ""} />
      <div className="flex flex-1 min-h-0 max-md:flex-col">
        <Sidebar unreadNotifications={unreadNotifications} />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
