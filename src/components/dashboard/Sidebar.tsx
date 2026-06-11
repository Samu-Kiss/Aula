"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ResizablePanel } from "@/components/dashboard/ResizablePanel";

const NAV = [
  { label: "Clases", href: "/dashboard", badge: false },
  { label: "Notificaciones", href: "/dashboard/notificaciones", badge: true },
  { label: "Archivo", href: "/dashboard/archivo", badge: false },
];

interface Props {
  unreadNotifications?: number;
}

export function Sidebar({ unreadNotifications = 0 }: Props) {
  const pathname = usePathname();

  return (
    <ResizablePanel
      storageKey="aula:dash-sidebar-w"
      defaultWidth={224}
      minWidth={176}
      maxWidth={400}
      className="border-r border-[rgba(0,0,0,0.08)] bg-surface"
    >
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, badge }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center h-9 px-3 rounded-[8px] text-body transition-colors ${
                active
                  ? "bg-surface-alt text-ink font-medium"
                  : "text-ink-soft hover:bg-surface-alt hover:text-ink"
              }`}
            >
              <span className="flex-1">{label}</span>
              {badge && unreadNotifications > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>
    </ResizablePanel>
  );
}
