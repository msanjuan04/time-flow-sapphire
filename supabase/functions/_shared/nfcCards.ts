/**
 * Reconocer la tarjeta de un trabajador.
 *
 * El UID llega distinto según el lector: con dos puntos, en mayúsculas,
 * y a veces con los bytes al revés. Además, en `nfc_cards` conviven tres
 * columnas con el mismo dato según quién diera de alta la tarjeta
 * (`uid`, `card_uid`, `card_uid_normalized`).
 *
 * Por eso se compara contra TODAS las columnas y en los dos sentidos de
 * byte: una tarjeta que un día funcionó no puede dejar de funcionar
 * porque el alta se guardara en otra columna.
 */

export interface NfcCardRow {
  user_id?: string | null;
  empleado_id?: string | null;
  uid?: string | null;
  card_uid?: string | null;
  card_uid_normalized?: string | null;
  active?: boolean | null;
}

/** Solo letras y números, en minúsculas: "04:A2:3B" y "04a23b" son el mismo UID. */
export const normalizeUid = (raw: string): string => raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

/** Algunos lectores entregan el UID con los bytes en orden inverso. */
export const reverseBytes = (hex: string): string =>
  hex.length % 2 === 0 ? (hex.match(/.{2}/g) || []).reverse().join("") : hex;

/** Las formas en las que puede estar guardada esta tarjeta. */
const storedUids = (card: NfcCardRow): string[] =>
  [card.uid, card.card_uid, card.card_uid_normalized]
    .map((value) => (value ? normalizeUid(String(value)) : ""))
    .filter((value) => value !== "");

export const cardMatchesUid = (card: NfcCardRow, rawUid: string): boolean => {
  if (card.active === false) return false;
  const norm = normalizeUid(rawUid);
  if (!norm) return false;
  const buscados = new Set([norm, reverseBytes(norm)]);
  return storedUids(card).some((stored) => buscados.has(stored));
};

export const findCardForUid = (cards: NfcCardRow[], rawUid: string): NfcCardRow | null =>
  cards.find((card) => cardMatchesUid(card, rawUid)) ?? null;

/** A quién pertenece la tarjeta, se llame como se llame la columna. */
export const cardUserId = (card: NfcCardRow | null): string | null =>
  (card?.user_id || card?.empleado_id) ?? null;
