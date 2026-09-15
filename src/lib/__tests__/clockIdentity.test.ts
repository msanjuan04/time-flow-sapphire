import { describe, it, expect } from "vitest";
import { chooseCredential } from "../../../supabase/functions/_shared/clockIdentity";

/**
 * El 15/09/2026 el responsable de Santa Marta entró a comprobar los
 * fichajes en el mismo ordenador del lector. Su sesión viajaba en cada
 * llamada y ganaba a la tarjeta: trece pasadas seguidas quedaron
 * registradas a su nombre en vez de al de cada trabajador.
 */

describe("de quién es el fichaje", () => {
  it("la tarjeta manda aunque haya una sesión abierta en ese ordenador", () => {
    expect(chooseCredential({ hasSession: true, cardUid: "04a23b9c" })).toBe("card");
  });

  it("el PIN del kiosco también manda sobre la sesión", () => {
    expect(chooseCredential({ hasSession: true, devicePin: "AB12CD", userId: "ana" })).toBe("device_pin");
  });

  it("la tarjeta manda sobre el PIN si llegaran los dos", () => {
    expect(
      chooseCredential({ hasSession: true, cardUid: "04a23b9c", devicePin: "AB12CD", userId: "ana" })
    ).toBe("card");
  });

  it("sin tarjeta ni PIN, ficha quien ha iniciado sesión: móvil y web", () => {
    expect(chooseCredential({ hasSession: true })).toBe("session");
  });

  it("un PIN sin decir a quién no identifica a nadie", () => {
    expect(chooseCredential({ hasSession: false, devicePin: "AB12CD" })).toBeNull();
    expect(chooseCredential({ hasSession: true, devicePin: "AB12CD" })).toBe("session");
  });

  it("sin ninguna credencial no se ficha", () => {
    expect(chooseCredential({})).toBeNull();
    expect(chooseCredential({ hasSession: false, cardUid: "   ", devicePin: "" })).toBeNull();
  });

  it("un user_id suelto nunca basta: esa era la puerta abierta de antes", () => {
    expect(chooseCredential({ hasSession: false, userId: "ana" })).toBeNull();
  });
});
