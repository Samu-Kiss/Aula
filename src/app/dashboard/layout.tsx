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

  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header email={user?.email ?? ""} />
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
