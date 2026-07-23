import Link from "next/link";
import { Lockup } from "@/components/Lockup";
import type { Class } from "@/lib/types/db";

interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  cls: Class;
  crumbs?: Crumb[]; // breadcrumbs después de la clase
}

export function ClassNav({ cls, crumbs = [] }: Props) {
  return (
    // z-30: por encima de las capas de contenido (z-10: sidebar fija, cabeceras
    // de tabla sticky, controles del mapa) y por debajo del grano (z-40) y de
    // los overlays a pantalla completa (z-50).
    <nav className="sticky top-0 z-30 bg-page/90 backdrop-blur border-b border-hairline">
      <div className="px-5 md:px-10 max-w-4xl mx-auto h-16 flex items-center gap-3 min-w-0">
        <Link href={`/c/${cls.slug}`} className="shrink-0 hover:opacity-80 transition-opacity">
          <Lockup
            title={cls.title}
            accent={cls.accent}
            splitAt={cls.lockup_split_at}
            className="text-xl"
          />
        </Link>

        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-3 min-w-0">
            <span className="text-ink-mute shrink-0 text-[15px]">/</span>
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-[15px] text-ink-soft hover:text-ink transition-colors truncate"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-[15px] text-ink truncate">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}
