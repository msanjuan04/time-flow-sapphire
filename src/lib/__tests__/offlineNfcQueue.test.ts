import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { invokeNfcWithQueue, flushNfcQueue, readNfcQueue, enqueueNfcEvent } from "@/lib/offlineNfcQueue";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, rpc: vi.fn() },
}));

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;
const COMPANY = "686460ff-173e-4090-b75b-72aa8bf78079";
const CARD = "53:AE:93:AF:A1:00:01";

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true });
};

/** Respuesta de `clock` cuando el servidor rechaza (non-2xx). */
const serverRejection = (body: Record<string, unknown>) => ({
  data: null,
  error: {
    name: "FunctionsHttpError",
    message: "Edge Function returned a non-2xx status code",
    context: new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }),
  },
});

describe("offlineNfcQueue (kiosco NFC → función clock)", () => {
  beforeEach(() => {
    invoke.mockReset();
    window.localStorage.clear();
    setOnline(true);
  });

  it("con conexión llama a clock con la tarjeta como credencial y no encola", async () => {
    invoke.mockResolvedValue({
      data: { success: true, action: "in", employee_name: "Ana Pérez", status: "working" },
      error: null,
    });
    const r = await invokeNfcWithQueue(COMPANY, CARD);
    expect(r.ok).toBe(true);
    expect(r.queued).toBe(false);
    expect(r.data).toEqual({ ok: true, action: "clock_in", nombre_completo: "Ana Pérez" });
    const [fn, opts] = invoke.mock.calls[0];
    expect(fn).toBe("clock");
    expect(opts.body).toMatchObject({ action: "auto", source: "nfc", company_id: COMPANY, card_uid: CARD });
    expect(typeof opts.body.client_event_time).toBe("string");
    expect(readNfcQueue()).toHaveLength(0);
  });

  it("la salida se traduce a clock_out", async () => {
    invoke.mockResolvedValue({ data: { success: true, action: "out", employee_name: "Ana" }, error: null });
    const r = await invokeNfcWithQueue(COMPANY, CARD);
    expect(r.data?.action).toBe("clock_out");
  });

  it("tarjeta no registrada → unknown_card, sin encolar", async () => {
    invoke.mockResolvedValue(serverRejection({ error: "CARD_NOT_REGISTERED", message: "Tarjeta no reconocida." }));
    const r = await invokeNfcWithQueue(COMPANY, "00:11:22:33");
    expect(r.queued).toBe(false);
    expect(r.data).toMatchObject({ ok: false, error: "unknown_card" });
    expect(readNfcQueue()).toHaveLength(0);
  });

  it("baja médica → on_sick_leave con el mensaje del servidor", async () => {
    invoke.mockResolvedValue(serverRejection({ error: "ON_SICK_LEAVE", message: "Estás de baja aprobada." }));
    const r = await invokeNfcWithQueue(COMPANY, CARD);
    expect(r.data).toMatchObject({ ok: false, error: "on_sick_leave", message: "Estás de baja aprobada." });
  });

  it("una regla de la empresa (horario, festivo, límite) llega como server_error con su texto", async () => {
    invoke.mockResolvedValue(serverRejection({ error: "No puedes fichar todavía" }));
    const r = await invokeNfcWithQueue(COMPANY, CARD);
    expect(r.data).toMatchObject({ ok: false, error: "server_error", message: "No puedes fichar todavía" });
  });

  it("sin conexión encola la pasada con su hora real y no llama al servidor", async () => {
    setOnline(false);
    const before = Date.now();
    const r = await invokeNfcWithQueue(COMPANY, CARD);
    expect(r.queued).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
    const q = readNfcQueue();
    expect(q).toHaveLength(1);
    expect(q[0].rawUid).toBe(CARD);
    expect(new Date(q[0].clientEventTime).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("un fallo de red durante la llamada también encola", async () => {
    invoke.mockResolvedValue({ data: null, error: { name: "FunctionsFetchError", message: "Failed to fetch" } });
    const r = await invokeNfcWithQueue(COMPANY, CARD);
    expect(r.queued).toBe(true);
    expect(readNfcQueue()).toHaveLength(1);
  });

  it("al volver la conexión, flush envía cada pasada con su hora original y vacía la cola", async () => {
    setOnline(false);
    await invokeNfcWithQueue(COMPANY, "card-1");
    await invokeNfcWithQueue(COMPANY, "card-2");
    const [first] = readNfcQueue();
    setOnline(true);
    invoke.mockResolvedValue({ data: { success: true, action: "in" }, error: null });

    const result = await flushNfcQueue();

    expect(result).toEqual({ flushed: 2, remaining: 0 });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[0][1].body.client_event_time).toBe(first.clientEventTime);
  });

  it("una pasada rechazada por el servidor se descarta tras 3 intentos para no bloquear la cola", async () => {
    enqueueNfcEvent(COMPANY, "desconocida");
    invoke.mockResolvedValue(serverRejection({ error: "CARD_NOT_REGISTERED" }));
    await flushNfcQueue();
    await flushNfcQueue();
    expect(readNfcQueue()).toHaveLength(1);
    expect(readNfcQueue()[0].attempts).toBe(2);
    await flushNfcQueue();
    expect(readNfcQueue()).toHaveLength(0);
  });

  it("si la red falla a mitad del flush, se conserva lo pendiente", async () => {
    enqueueNfcEvent(COMPANY, "a");
    enqueueNfcEvent(COMPANY, "b");
    invoke.mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await flushNfcQueue();
    expect(result.flushed).toBe(0);
    expect(result.remaining).toBe(2);
  });
});
