"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Clases", href: "/dashboard" },
  { label: "Notificaciones", href: "/dashboard/notificaciones" },
  { label: "Archivo", href: "/dashboard/archivo" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-[rgba(0,0,0,0.08)] bg-surface min-h-screen">
      <div className="px-6 py-6 border-b border-[rgba(0,0,0,0.08)]">
        <span className="font-black text-2xl leading-none text-ink tracking-tight">
          Aula
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ label, href }) => {
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
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
