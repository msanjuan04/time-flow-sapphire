import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { invokeNfcWithQueue, flushNfcQueue, readNfcQueue, enqueueNfcEvent } from "@/lib/offlineNfcQueue";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
const COMPANY = "686460ff-173e-4090-b75b-72aa8bf78079";

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true });
};

describe("offlineNfcQueue (cola sin conexión del kiosco NFC)", () => {
  beforeEach(() => {
    rpc.mockReset();
    window.localStorage.clear();
    setOnline(true);
  });

  it("con conexión llama a nfc_kiosk_clock con la hora del cliente y no encola", async () => {
    rpc.mockResolvedValue({ data: { ok: true, action: "clock_in", nombre_completo: "Ana" }, error: null });
    const r = await invokeNfcWithQueue(COMPANY, "53:AE:93:AF:A1:00:01");
    expect(r.ok).toBe(true);
    expect(r.queued).toBe(false);
    expect(r.data.action).toBe("clock_in");
    const args = rpc.mock.calls[0];
    expect(args[0]).toBe("nfc_kiosk_clock");
    expect(args[1].p_company_id).toBe(COMPANY);
    expect(args[1].p_raw_uid).toBe("53:AE:93:AF:A1:00:01");
    expect(typeof args[1].p_event_time).toBe("string");
    expect(readNfcQueue()).toHaveLength(0);
  });

  it("sin conexión encola la pasada con su hora real y no llama al servidor", async () => {
    setOnline(false);
    const before = Date.now();
    const r = await invokeNfcWithQueue(COMPANY, "abc");
    expect(r.queued).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    const q = readNfcQueue();
    expect(q).toHaveLength(1);
    expect(q[0].rawUid).toBe("abc");
    expect(new Date(q[0].clientEventTime).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("un fallo de red durante la llamada también encola", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    const r = await invokeNfcWithQueue(COMPANY, "abc");
    expect(r.queued).toBe(true);
    expect(readNfcQueue()).toHaveLength(1);
  });

  it("un error de validación del servidor NO se encola (se muestra al momento)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    const r = await invokeNfcWithQueue(COMPANY, "abc");
    expect(r.ok).toBe(false);
    expect(r.queued).toBe(false);
    expect(readNfcQueue()).toHaveLength(0);
  });

  it("al volver la conexión, flush envía cada pasada con su hora original y vacía la cola", async () => {
    setOnline(false);
    await invokeNfcWithQueue(COMPANY, "card-1");
    await invokeNfcWithQueue(COMPANY, "card-2");
    const [first] = readNfcQueue();
    setOnline(true);
    rpc.mockResolvedValue({ data: { ok: true, action: "clock_in" }, error: null });

    const result = await flushNfcQueue();

    expect(result).toEqual({ flushed: 2, remaining: 0 });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1].p_event_time).toBe(first.clientEventTime);
  });

  it("una tarjeta desconocida encolada se descarta tras 3 intentos para no bloquear la cola", async () => {
    enqueueNfcEvent(COMPANY, "desconocida");
    rpc.mockResolvedValue({ data: { ok: false, error: "unknown_card" }, error: null });
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
    rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await flushNfcQueue();
    expect(result.flushed).toBe(0);
    expect(result.remaining).toBe(2);
  });
});
