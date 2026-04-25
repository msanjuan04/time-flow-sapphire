export type AbsenceCategory =
  | "vacation"
  | "sick_leave"
  | "maternity"
  | "paternity"
  | "permit"
  | "medical_visit"
  | "training"
  | "other";

export interface AbsenceReason {
  value: string;
  label: string;
  category: AbsenceCategory;
}

export const DEFAULT_ABSENCE_REASON = "vacaciones";

export const ABSENCE_REASONS: AbsenceReason[] = [
  { value: "vacaciones", label: "Vacaciones", category: "vacation" },
  { value: "baja-medica", label: "Baja médica", category: "sick_leave" },
  { value: "baja-maternidad", label: "Baja por maternidad", category: "maternity" },
  { value: "baja-paternidad", label: "Baja por paternidad", category: "paternity" },
  { value: "matrimonio", label: "Matrimonio", category: "permit" },
  { value: "nacimiento", label: "Nacimiento de hijo", category: "permit" },
  { value: "fallecimiento", label: "Fallecimiento de familiar", category: "permit" },
  { value: "hospitalizacion", label: "Hospitalización familiar", category: "permit" },
  { value: "cuidado-familiar", label: "Cuidado de familiar dependiente", category: "permit" },
  { value: "lactancia", label: "Lactancia", category: "permit" },
  { value: "mudanza", label: "Mudanza", category: "permit" },
  { value: "deber-publico", label: "Deber público o legal", category: "permit" },
  { value: "visita-medica", label: "Visita médica", category: "medical_visit" },
  { value: "dental-medica", label: "Tratamiento médico", category: "medical_visit" },
  { value: "formacion", label: "Formación profesional", category: "training" },
  { value: "otro", label: "Otro motivo (especificar)", category: "other" },
];

export const ABSENCE_CATEGORY_META: Record<
  AbsenceCategory,
  { label: string; badgeClass: string }
> = {
  vacation: { label: "Vacaciones", badgeClass: "bg-blue-600 text-white" },
  sick_leave: { label: "Baja médica", badgeClass: "bg-red-600 text-white" },
  maternity: { label: "Maternidad", badgeClass: "bg-pink-600 text-white" },
  paternity: { label: "Paternidad", badgeClass: "bg-indigo-600 text-white" },
  permit: { label: "Permiso", badgeClass: "bg-amber-600 text-white" },
  medical_visit: { label: "Visita médica", badgeClass: "bg-teal-600 text-white" },
  training: { label: "Formación", badgeClass: "bg-purple-600 text-white" },
  other: { label: "Otro", badgeClass: "bg-slate-600 text-white" },
};

export const getAbsenceReasonByValue = (value: string) =>
  ABSENCE_REASONS.find((reason) => reason.value === value);

export const getAbsenceCategoryFromLabelOrValue = (raw: string): AbsenceCategory => {
  if (!raw) return "other";
  const byValue = ABSENCE_REASONS.find((r) => r.value === raw);
  if (byValue) return byValue.category;
  const byLabel = ABSENCE_REASONS.find(
    (r) => r.label.toLowerCase() === raw.toLowerCase()
  );
  return byLabel?.category ?? "other";
};
