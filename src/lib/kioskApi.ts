import { supabase } from "@/integrations/supabase/client";

/**
 * Acceso del kiosco por PIN a través de funciones de servidor.
 *
 * Antes, las pantallas de kiosco leían `devices` y `profiles` directamente
 * con la clave anónima, lo que obligaba a tener políticas que exponían
 * todos los códigos de acceso. Ahora todo pasa por dos RPC SECURITY DEFINER
 * (migración 20260911100000) que devuelven solo lo imprescindible.
 */

export interface KioskDevice {
  id: string;
  company_id: string;
  name: string;
  center_id?: string | null;
}

export interface KioskEmployee {
  id: string;
  full_name: string | null;
  email: string | null;
}

export type KioskStatus = "off" | "on" | "break";

export type KioskError =
  | "empty_pin"
  | "device_not_found"
  | "missing_params"
  | "code_not_found"
  | "employee_inactive"
  | "not_member"
  | "network";

export const KIOSK_ERROR_MESSAGES: Record<KioskError, string> = {
  empty_pin: "Introduce el PIN del dispositivo",
  device_not_found: "PIN incorrecto",
  missing_params: "Faltan datos",
  code_not_found: "Código no reconocido",
  employee_inactive: "Este empleado está dado de baja",
  not_member: "El código no pertenece a esta empresa",
  network: "Sin conexión con el servidor",
};

type Result<T> = { ok: true; data: T } | { ok: false; error: KioskError };

const normalizeError = (raw: unknown): KioskError => {
  const s = typeof raw === "string" ? raw : "";
  return (Object.keys(KIOSK_ERROR_MESSAGES) as KioskError[]).includes(s as KioskError)
    ? (s as KioskError)
    : "network";
};

export const kioskDeviceByPin = async (pin: string): Promise<Result<KioskDevice>> => {
  const { data, error } = await supabase.rpc("kiosk_device_by_pin" as never, { p_pin: pin } as never);
  if (error) return { ok: false, error: "network" };
  const payload = (data || {}) as { ok?: boolean; error?: string; device?: KioskDevice };
  if (!payload.ok || !payload.device) return { ok: false, error: normalizeError(payload.error) };
  return { ok: true, data: payload.device };
};

export const kioskEmployeeByCode = async (
  pin: string,
  code: string
): Promise<Result<{ device: KioskDevice; employee: KioskEmployee; status: KioskStatus }>> => {
  const { data, error } = await supabase.rpc(
    "kiosk_employee_by_code" as never,
    { p_pin: pin, p_code: code } as never
  );
  if (error) return { ok: false, error: "network" };
  const payload = (data || {}) as {
    ok?: boolean;
    error?: string;
    device?: KioskDevice;
    employee?: KioskEmployee;
    status?: KioskStatus;
  };
  if (!payload.ok || !payload.device || !payload.employee) {
    return { ok: false, error: normalizeError(payload.error) };
  }
  return {
    ok: true,
    data: { device: payload.device, employee: payload.employee, status: payload.status ?? "off" },
  };
};
