import Link from "next/link";
import { logoutAction } from "@/app/login/actions";

interface Props {
  email: string;
}

export function Header({ email }: Props) {
  return (
    <header className="relative h-14 shrink-0 flex items-stretch border-b border-hairline bg-surface">
      {/* Marca, alineada con el ancho del sidebar de abajo */}
      <Link
        href="/dashboard"
        className="w-auto px-4 md:w-56 md:px-6 shrink-0 flex items-center hover:opacity-80 transition-opacity"
      >
        <span className="font-black text-2xl leading-none text-ink tracking-tight">
          Aula
        </span>
      </Link>

      {/* Título + breadcrumbs centrados respecto a toda la barra (vía portal) */}
      <div
        id="dashboard-header-slot"
        className="absolute left-1/2 top-0 h-full -translate-x-1/2 flex items-center gap-3 px-8 min-w-0 max-w-[55%] overflow-hidden"
      />

      <div className="ml-auto flex items-center gap-4 px-4 md:px-8 shrink-0">
        <span className="text-mono text-ink-mute max-md:hidden">{email}</span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-caption text-ink-soft hover:text-ink transition-colors px-2 py-2.5 -mx-2"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
