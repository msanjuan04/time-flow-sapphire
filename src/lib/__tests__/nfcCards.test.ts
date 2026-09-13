import { describe, it, expect } from "vitest";
import {
  cardMatchesUid,
  cardUserId,
  findCardForUid,
  normalizeUid,
  reverseBytes,
  type NfcCardRow,
} from "../../../supabase/functions/_shared/nfcCards";

/**
 * Una tarjeta que ayer abría la puerta no puede dejar de hacerlo porque
 * el alta guardara el UID en otra columna o el lector lo entregue con
 * otro formato. Cada caso de aquí es una forma real de dar de alta una
 * tarjeta en nfc_cards.
 */

const card = (over: Partial<NfcCardRow> = {}): NfcCardRow => ({
  user_id: "ana",
  uid: null,
  card_uid: null,
  card_uid_normalized: null,
  active: true,
  ...over,
});

describe("cómo llega el UID del lector", () => {
  it("da igual mayúsculas, dos puntos o guiones", () => {
    expect(normalizeUid("04:A2:3B:9C")).toBe("04a23b9c");
    expect(normalizeUid("04-a2-3b-9c")).toBe("04a23b9c");
    expect(normalizeUid("  04A23B9C ")).toBe("04a23b9c");
  });

  it("los bytes al revés son el mismo UID leído del otro lado", () => {
    expect(reverseBytes("04a23b9c")).toBe("9c3ba204");
    expect(reverseBytes("abc")).toBe("abc"); // impar: se deja como está
  });
});

describe("reconocer la tarjeta esté guardada donde esté", () => {
  it("dada de alta en card_uid_normalized", () => {
    expect(cardMatchesUid(card({ card_uid_normalized: "04a23b9c" }), "04:A2:3B:9C")).toBe(true);
  });

  it("dada de alta en card_uid", () => {
    expect(cardMatchesUid(card({ card_uid: "04:A2:3B:9C" }), "04a23b9c")).toBe(true);
  });

  it("dada de alta en uid", () => {
    expect(cardMatchesUid(card({ uid: "04A23B9C" }), "04:a2:3b:9c")).toBe(true);
  });

  it("con el lector que invierte los bytes", () => {
    expect(cardMatchesUid(card({ card_uid_normalized: "04a23b9c" }), "9C:3B:A2:04")).toBe(true);
  });

  it("REGRESIÓN: uid con otro valor no puede tapar a card_uid_normalized", () => {
    // Así se rompió: se comparaba solo la primera columna con contenido.
    const mixta = card({ uid: "0000000000", card_uid_normalized: "04a23b9c" });
    expect(cardMatchesUid(mixta, "04:A2:3B:9C")).toBe(true);
  });

  it("una tarjeta de otra persona no cuela", () => {
    expect(cardMatchesUid(card({ card_uid_normalized: "aabbccdd" }), "04a23b9c")).toBe(false);
  });

  it("la tarjeta desactivada no vale aunque coincida", () => {
    expect(cardMatchesUid(card({ card_uid_normalized: "04a23b9c", active: false }), "04a23b9c")).toBe(false);
  });

  it("una fila sin ningún UID no coincide con nada", () => {
    expect(cardMatchesUid(card(), "04a23b9c")).toBe(false);
    expect(cardMatchesUid(card({ card_uid_normalized: "" }), "")).toBe(false);
  });
});

describe("a quién pertenece la tarjeta", () => {
  const cards = [
    card({ user_id: "ana", card_uid_normalized: "aaaa1111" }),
    card({ user_id: null, empleado_id: "luis", uid: "BBBB2222" }),
    card({ user_id: "eva", card_uid: "cc:cc:33:33", active: false }),
  ];

  it("encuentra a la persona de la tarjeta", () => {
    expect(cardUserId(findCardForUid(cards, "AAAA:1111"))).toBe("ana");
  });

  it("acepta el alta antigua, que guardaba empleado_id", () => {
    expect(cardUserId(findCardForUid(cards, "bbbb2222"))).toBe("luis");
  });

  it("una tarjeta desactivada no identifica a nadie", () => {
    expect(findCardForUid(cards, "cccc3333")).toBeNull();
    expect(cardUserId(null)).toBeNull();
  });

  it("una tarjeta que no está dada de alta tampoco", () => {
    expect(findCardForUid(cards, "ffff9999")).toBeNull();
  });
});
