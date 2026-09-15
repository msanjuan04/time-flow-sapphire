/**
 * De quién es el fichaje.
 *
 * Tres credenciales posibles, y el orden importa más de lo que parece:
 *
 *   1. Tarjeta NFC  — la tarjeta identifica al trabajador.
 *   2. PIN del dispositivo — el kiosco identifica al trabajador elegido.
 *   3. Sesión (JWT) — la persona ficha por sí misma desde su móvil o la web.
 *
 * La sesión va LA ÚLTIMA a propósito. El navegador del kiosco manda la
 * sesión de quien se haya identificado en ese ordenador, y si la sesión
 * ganase, todas las tarjetas que se pasaran después quedarían registradas
 * a nombre de esa persona. Pasó en Santa Marta el 15/09/2026: el
 * responsable entró a comprobar los fichajes en el mismo ordenador del
 * lector y trece pasadas de tarjeta se guardaron a su nombre.
 *
 * Regla: la credencial más concreta que se presenta es la que manda.
 */

export type Credential = "card" | "device_pin" | "session" | null;

export interface CredentialInput {
  /** Hay sesión iniciada y verificada en el servidor. */
  hasSession?: boolean;
  cardUid?: unknown;
  devicePin?: unknown;
  /** A quién ficha el kiosco por PIN. */
  userId?: unknown;
}

const noVacio = (value: unknown): boolean => typeof value === "string" && value.trim() !== "";

export const chooseCredential = (input: CredentialInput): Credential => {
  if (noVacio(input.cardUid)) return "card";
  if (noVacio(input.devicePin) && noVacio(input.userId)) return "device_pin";
  if (input.hasSession) return "session";
  return null;
};
