import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { kioskDeviceByPin, kioskEmployeeByCode, KIOSK_ERROR_MESSAGES } from "@/lib/kioskApi";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

describe("kioskApi (kiosco por PIN → funciones de servidor)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("kioskDeviceByPin llama a kiosk_device_by_pin y devuelve el dispositivo", async () => {
    rpc.mockResolvedValue({
      data: { ok: true, device: { id: "d1", company_id: "c1", name: "Recepción" } },
      error: null,
    });
    const r = await kioskDeviceByPin("ab12cd");
    expect(rpc).toHaveBeenCalledWith("kiosk_device_by_pin", { p_pin: "ab12cd" });
    expect(r.ok).toBe(true);
    expect(r.data?.name).toBe("Recepción");
    expect(r.error).toBeNull();
  });

  it("PIN incorrecto → error device_not_found con mensaje para el usuario", async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: "device_not_found" }, error: null });
    const r = await kioskDeviceByPin("ZZZZZZ");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("device_not_found");
    expect(KIOSK_ERROR_MESSAGES[r.error!]).toBe("PIN incorrecto");
  });

  it("fallo de red o del servidor → error network, nunca lanza", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    const r = await kioskDeviceByPin("ab12cd");
    expect(r).toEqual({ ok: false, data: null, error: "network" });
  });

  it("un error desconocido del servidor se normaliza a network", async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: "algo_nuevo" }, error: null });
    const r = await kioskDeviceByPin("ab12cd");
    expect(r.error).toBe("network");
  });

  it("kioskEmployeeByCode envía PIN y código y devuelve empleado + estado", async () => {
    rpc.mockResolvedValue({
      data: {
        ok: true,
        device: { id: "d1", company_id: "c1", name: "Recepción" },
        employee: { id: "u1", full_name: "Ana", email: "ana@x.com" },
        status: "break",
      },
      error: null,
    });
    const r = await kioskEmployeeByCode("ab12cd", "123456");
    expect(rpc).toHaveBeenCalledWith("kiosk_employee_by_code", { p_pin: "ab12cd", p_code: "123456" });
    expect(r.ok).toBe(true);
    expect(r.data?.employee.full_name).toBe("Ana");
    expect(r.data?.status).toBe("break");
  });

  it("código de otra empresa → not_member", async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: "not_member" }, error: null });
    const r = await kioskEmployeeByCode("ab12cd", "123456");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not_member");
    expect(KIOSK_ERROR_MESSAGES.not_member).toMatch(/no pertenece/i);
  });

  it("si falta status en la respuesta se asume off", async () => {
    rpc.mockResolvedValue({
      data: { ok: true, device: { id: "d1", company_id: "c1", name: "R" }, employee: { id: "u1", full_name: null, email: null } },
      error: null,
    });
    const r = await kioskEmployeeByCode("ab12cd", "123456");
    expect(r.data?.status).toBe("off");
  });
});
