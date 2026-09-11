import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import {
  invokeClockWithQueue,
  flushClockQueue,
  readQueue,
  extractFunctionErrorMessage,
} from "@/lib/offlineClockQueue";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true });
};

const payload = { action: "in" as const, user_id: "u1", company_id: "c1", source: "kiosk-free" };

describe("offlineClockQueue (fichaje móvil/kiosco por PIN)", () => {
  beforeEach(() => {
    invoke.mockReset();
    window.localStorage.clear();
    setOnline(true);
  });

  it("con conexión invoca la función clock añadiendo client_event_time", async () => {
    invoke.mockResolvedValue({ data: { success: true, status: "working" }, error: null });
    const r = await invokeClockWithQueue({ payload });
    expect(r.ok).toBe(true);
    expect(r.queued).toBe(false);
    const [name, opts] = invoke.mock.calls[0];
    expect(name).toBe("clock");
    expect(opts.body.action).toBe("in");
    expect(typeof opts.body.client_event_time).toBe("string");
  });

  it("un error de validación del servidor no se encola y devuelve el cuerpo", async () => {
    invoke.mockResolvedValue({ data: { success: false, error: "Ya tienes una sesión activa" }, error: { message: "non-2xx" } });
    const r = await invokeClockWithQueue({ payload });
    expect(r.ok).toBe(false);
    expect(r.queued).toBe(false);
    expect(readQueue()).toHaveLength(0);
  });

  it("sin conexión encola y el flush posterior envía la hora original", async () => {
    setOnline(false);
    const r = await invokeClockWithQueue({ payload });
    expect(r.queued).toBe(true);
    const [item] = readQueue();
    setOnline(true);
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    const res = await flushClockQueue();
    expect(res).toEqual({ flushed: 1, remaining: 0 });
    expect(invoke.mock.calls[0][1].body.client_event_time).toBe(item.clientEventTime);
  });

  it("una excepción de red encola por defecto, salvo queueOnFailure=false", async () => {
    invoke.mockRejectedValue(new TypeError("Failed to fetch"));
    const queued = await invokeClockWithQueue({ payload });
    expect(queued.queued).toBe(true);
    expect(readQueue()).toHaveLength(1);

    window.localStorage.clear();
    const notQueued = await invokeClockWithQueue({ payload, queueOnFailure: false });
    expect(notQueued.ok).toBe(false);
    expect(readQueue()).toHaveLength(0);
  });
});

describe("extractFunctionErrorMessage", () => {
  it("prefiere el error del cuerpo de la respuesta", async () => {
    expect(await extractFunctionErrorMessage(new Error("x"), { error: "MISSING_CODE" })).toBe("MISSING_CODE");
    expect(await extractFunctionErrorMessage(null, { message: "Email inválido" })).toBe("Email inválido");
    expect(await extractFunctionErrorMessage(null, "texto plano")).toBe("texto plano");
  });

  it("lee el cuerpo JSON adjunto al error (error.context) cuando data viene vacío", async () => {
    const context = new Response(JSON.stringify({ error: "company_suspended" }), {
      headers: { "Content-Type": "application/json" },
    });
    expect(await extractFunctionErrorMessage({ context })).toBe("company_suspended");
  });

  it("ignora el mensaje genérico non-2xx y devuelve null si no hay nada útil", async () => {
    expect(await extractFunctionErrorMessage(new Error("Edge Function returned a non-2xx status code"))).toBeNull();
    expect(await extractFunctionErrorMessage(new Error("Timeout"))).toBe("Timeout");
    expect(await extractFunctionErrorMessage(undefined)).toBeNull();
  });
});
