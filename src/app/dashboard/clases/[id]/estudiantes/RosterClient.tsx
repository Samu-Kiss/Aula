"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  enrollStudentAction,
  importRosterAction,
  setEnrollmentStatusAction,
  updateStudentAction,
  removeFromRosterAction,
} from "./actions";

interface Enrollment {
  id: string;
  status: string;
  created_at: string;
  students: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
  };
}

interface Props {
  classId: string;
  initialEnrollments: Enrollment[];
}

function studentLabel(s: Enrollment["students"]) {
  if (s.display_name) return s.display_name;
  if (s.first_name || s.last_name)
    return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
  return s.email;
}

export function RosterClient({ classId, initialEnrollments }: Props) {
  const router = useRouter();
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Inline-edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? "");
    reader.readAsText(file, "utf-8");
  }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await enrollStudentAction(classId, fd);
      if (!res.ok) {
        setAddError(res.error === "invalid_email" ? "Email inválido" : (res.error ?? "Error"));
      } else {
        formRef.current?.reset();
        setShowAddForm(false);
        router.refresh();
      }
    });
  }

  function handleImport() {
    if (!csvText.trim()) return;
    setImportResult(null);
    startTransition(async () => {
      const res = await importRosterAction(classId, csvText);
      setImportResult({ imported: res.imported, errors: res.errors });
      if (res.imported > 0) {
        setCsvText("");
        router.refresh();
      }
    });
  }

  function handleToggleStatus(enrollmentId: string, current: string) {
    if (enrollmentId.startsWith("implicit-")) return;
    const next = current === "active" ? "inactive" : "active";
    startTransition(async () => {
      await setEnrollmentStatusAction(classId, enrollmentId, next as "active" | "inactive");
      setEnrollments((prev) =>
        prev.map((e) => (e.id === enrollmentId ? { ...e, status: next } : e))
      );
    });
  }

  function openEdit(e: Enrollment) {
    setEditingId(e.id);
    setEditFirst(e.students.first_name ?? "");
    setEditLast(e.students.last_name ?? "");
    setEditError(null);
    setConfirmDeleteId(null);
  }

  function handleSaveEdit(enrollment: Enrollment) {
    setEditError(null);
    startTransition(async () => {
      const res = await updateStudentAction(
        classId,
        enrollment.students.id,
        editFirst.trim() || null,
        editLast.trim() || null
      );
      if (!res.ok) {
        setEditError(res.error ?? "Error al guardar");
        return;
      }
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === enrollment.id
            ? {
                ...e,
                students: {
                  ...e.students,
                  first_name: editFirst.trim() || null,
                  last_name: editLast.trim() || null,
                },
              }
            : e
        )
      );
      setEditingId(null);
    });
  }

  function handleDelete(enrollment: Enrollment) {
    startTransition(async () => {
      const res = await removeFromRosterAction(
        classId,
        enrollment.id,
        enrollment.students.id
      );
      if (!res.ok) return;
      setEnrollments((prev) => prev.filter((e) => e.id !== enrollment.id));
      setConfirmDeleteId(null);
    });
  }

  function handleApprove(enrollmentId: string) {
    startTransition(async () => {
      const res = await setEnrollmentStatusAction(classId, enrollmentId, "active");
      if (!res.ok) return;
      setEnrollments((prev) =>
        prev.map((e) => (e.id === enrollmentId ? { ...e, status: "active" } : e))
      );
      router.refresh();
    });
  }

  function handleReject(enrollment: Enrollment) {
    startTransition(async () => {
      const res = await removeFromRosterAction(classId, enrollment.id, enrollment.students.id);
      if (!res.ok) return;
      setEnrollments((prev) => prev.filter((e) => e.id !== enrollment.id));
      router.refresh();
    });
  }

  const pending = enrollments.filter((e) => e.status === "pending");
  const roster = enrollments.filter((e) => e.status !== "pending");
  const active = enrollments.filter((e) => e.status === "active");
  const inactive = enrollments.filter((e) => e.status === "inactive");

  return (
    <div className="space-y-5">
      {/* Pending access requests */}
      {pending.length > 0 && (
        <div className="rounded-[12px] border border-warning/30 bg-warning/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-warning/20">
            <p className="text-caption font-bold text-ink">
              Solicitudes de acceso pendientes ({pending.length})
            </p>
            <p className="text-mono text-ink-mute mt-0.5">
              Estos estudiantes se registraron desde la página pública de la clase y esperan tu aprobación.
            </p>
          </div>
          <ul>
            {pending.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-warning/10 last:border-0"
              >
                <div className="flex-1 min-w-[180px]">
                  <p className="text-body font-medium text-ink">{studentLabel(e.students)}</p>
                  <p className="text-mono text-ink-soft">{e.students.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(e.id)}
                    disabled={isPending}
                    className="px-4 py-1.5 bg-accent-deep text-page text-caption font-bold rounded-[8px] hover:bg-accent-deep/88 disabled:opacity-50 transition-colors"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => handleReject(e)}
                    disabled={isPending}
                    className="px-4 py-1.5 text-caption text-borgona border border-borgona/30 rounded-[8px] hover:bg-borgona/5 disabled:opacity-50 transition-colors"
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-caption text-ink-mute pt-1">
          {active.length} activo{active.length !== 1 ? "s" : ""}
          {inactive.length > 0 && ` · ${inactive.length} inactivo${inactive.length !== 1 ? "s" : ""}`}
          {pending.length > 0 && ` · ${pending.length} pendiente${pending.length !== 1 ? "s" : ""}`}
          {" · "}Los estudiantes solicitan acceso desde la página pública de la clase.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => { setShowImport((v) => !v); setShowAddForm(false); }}
            className="px-3 py-1.5 text-caption text-ink-soft border border-subtle rounded-[8px] hover:text-ink hover:border-ink/30 transition-colors"
          >
            Importar CSV
          </button>
          <button
            onClick={() => { setShowAddForm((v) => !v); setShowImport(false); }}
            className="px-3 py-1.5 text-caption bg-accent-deep text-page rounded-[8px] hover:bg-accent-deep/88 transition-colors"
          >
            + Agregar
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form ref={formRef} onSubmit={handleAdd} className="p-4 border border-subtle rounded-[12px] bg-surface-alt space-y-3">
          <p className="text-caption font-medium text-ink">Agregar estudiante</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-mono text-ink-mute mb-1">Email *</label>
              <input name="email" type="email" required className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40" />
            </div>
            <div>
              <label className="block text-mono text-ink-mute mb-1">Nombre</label>
              <input name="first_name" className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40" />
            </div>
            <div>
              <label className="block text-mono text-ink-mute mb-1">Apellido</label>
              <input name="last_name" className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40" />
            </div>
          </div>
          {addError && <p className="text-caption text-borgona">{addError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="px-4 py-1.5 bg-accent-deep text-page text-caption rounded-[8px] disabled:opacity-50">Agregar</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-1.5 text-caption text-ink-soft hover:text-ink transition-colors">Cancelar</button>
          </div>
        </form>
      )}

      {/* CSV import */}
      {showImport && (
        <div className="p-4 border border-subtle rounded-[12px] bg-surface-alt space-y-3">
          <div>
            <p className="text-caption font-medium text-ink mb-1">Importar desde CSV</p>
            <p className="text-mono text-ink-mute">Formato: email, nombre, apellido (una fila por estudiante)</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="text-body text-ink-soft" />
          {csvText && (
            <pre className="text-mono text-ink-soft bg-page rounded-[8px] p-3 max-h-32 overflow-auto text-[11px]">
              {csvText.split("\n").slice(0, 5).join("\n")}
              {csvText.split("\n").length > 5 && `\n… (${csvText.split("\n").length - 5} más)`}
            </pre>
          )}
          {importResult && (
            <div className="space-y-1">
              <p className="text-caption text-bosque">{importResult.imported} estudiante{importResult.imported !== 1 ? "s" : ""} importado{importResult.imported !== 1 ? "s" : ""}</p>
              {importResult.errors.map((e, i) => <p key={i} className="text-mono text-borgona">{e}</p>)}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleImport} disabled={isPending || !csvText.trim()} className="px-4 py-1.5 bg-accent-deep text-page text-caption rounded-[8px] disabled:opacity-50">Importar</button>
            <button onClick={() => { setShowImport(false); setCsvText(""); setImportResult(null); }} className="px-4 py-1.5 text-caption text-ink-soft hover:text-ink transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      {roster.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-subtle rounded-[12px]">
          <p className="text-body text-ink-soft">No hay estudiantes todavía.</p>
          <p className="text-caption text-ink-mute mt-1">Solicitan acceso desde la página pública de la clase, o agrégalos manualmente.</p>
        </div>
      ) : (
        <div className="rounded-[12px] border border-subtle overflow-hidden">
          <table className="min-w-full text-body border-collapse">
            <thead>
              <tr className="bg-surface-alt border-b border-hairline">
                <th className="text-left text-caption text-ink-mute font-medium px-4 py-3">Estudiante</th>
                <th className="text-left text-caption text-ink-mute font-medium px-4 py-3">Email</th>
                <th className="text-center text-caption text-ink-mute font-medium px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right text-caption text-ink-mute font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((e, i) => (
                <Fragment key={e.id}>
                  {/* Main row */}
                  <tr
                    className={`border-b border-[rgba(0,0,0,0.04)] ${editingId === e.id ? "" : "last:border-0"} ${i % 2 === 0 ? "bg-surface" : "bg-surface-alt/30"}`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-body font-medium text-ink">
                        {studentLabel(e.students)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-mono text-ink-soft">{e.students.email}</td>
                    <td className="px-4 py-3 text-center">
                      {/* Verde oscurecido: text-bosque sobre la fila tintada queda en 4.46:1, justo bajo AA */}
                      <span className={`inline-block px-2 py-0.5 rounded-full text-mono ${e.status === "active" ? "bg-bosque/10 text-[#1B5A46]" : "bg-surface-alt text-ink-mute"}`}>
                        {e.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {/* Edit */}
                        {editingId !== e.id && (
                          <button
                            onClick={() => openEdit(e)}
                            className="text-caption text-ink-mute hover:text-ink transition-colors py-1.5 px-1 -my-1.5"
                          >
                            Editar
                          </button>
                        )}
                        {/* Status toggle — only for non-implicit */}
                        {!e.id.startsWith("implicit-") && editingId !== e.id && (
                          <button
                            onClick={() => handleToggleStatus(e.id, e.status)}
                            disabled={isPending}
                            className="text-caption text-ink-mute hover:text-ink transition-colors disabled:opacity-40 py-1.5 px-1 -my-1.5"
                          >
                            {e.status === "active" ? "Desactivar" : "Reactivar"}
                          </button>
                        )}
                        {/* Delete */}
                        {editingId !== e.id && (
                          confirmDeleteId === e.id ? (
                            <span className="flex items-center gap-2">
                              <span className="text-caption text-ink-mute">¿Eliminar?</span>
                              <button
                                onClick={() => handleDelete(e)}
                                disabled={isPending}
                                className="text-caption text-borgona hover:text-borgona/80 disabled:opacity-40"
                              >
                                Sí
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-caption text-ink-mute hover:text-ink"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => { setConfirmDeleteId(e.id); setEditingId(null); }}
                              className="text-caption text-borgona hover:text-borgona/80 transition-colors py-1.5 px-1 -my-1.5"
                            >
                              Eliminar
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit row */}
                  {editingId === e.id && (
                    <tr className={`border-b border-[rgba(0,0,0,0.04)] last:border-0 ${i % 2 === 0 ? "bg-surface" : "bg-surface-alt/30"}`}>
                      <td colSpan={4} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-mono text-ink-mute mb-1">Nombre</label>
                            <input
                              value={editFirst}
                              onChange={(ev) => setEditFirst(ev.target.value)}
                              onKeyDown={(ev) => { if (ev.key === "Enter") handleSaveEdit(e); if (ev.key === "Escape") setEditingId(null); }}
                              className="h-8 px-3 w-40 rounded-[6px] border border-ink/30 bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40"
                            />
                          </div>
                          <div>
                            <label className="block text-mono text-ink-mute mb-1">Apellido</label>
                            <input
                              value={editLast}
                              onChange={(ev) => setEditLast(ev.target.value)}
                              onKeyDown={(ev) => { if (ev.key === "Enter") handleSaveEdit(e); if (ev.key === "Escape") setEditingId(null); }}
                              className="h-8 px-3 w-40 rounded-[6px] border border-ink/30 bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40"
                            />
                          </div>
                          <div className="flex gap-2 pb-0.5">
                            <button
                              onClick={() => handleSaveEdit(e)}
                              disabled={isPending}
                              className="px-3 py-1 bg-accent-deep text-page text-caption rounded-[6px] disabled:opacity-50"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 text-caption text-ink-mute hover:text-ink transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                          {editError && <p className="w-full text-mono text-borgona">{editError}</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
