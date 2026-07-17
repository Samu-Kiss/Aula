"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  id: string;
  name: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}

/**
 * Input de contraseña con botón para mostrar/ocultar.
 * Se usa dentro de forms con server actions (no maneja el valor, solo el tipo).
 */
export function PasswordField({
  id,
  name,
  autoComplete = "current-password",
  placeholder = "••••••••",
  required = true,
  minLength,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="w-full h-11 pl-3 pr-11 rounded-[8px] border-subtle bg-surface text-body text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-accent"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-ink-mute hover:text-ink transition-colors"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
