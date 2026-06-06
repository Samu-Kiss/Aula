import { logoutAction } from "@/app/login/actions";

interface Props {
  email: string;
}

export function Header({ email }: Props) {
  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-8 border-b border-[rgba(0,0,0,0.08)] bg-surface">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-mono text-ink-mute">{email}</span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-caption text-ink-soft hover:text-ink transition-colors"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
