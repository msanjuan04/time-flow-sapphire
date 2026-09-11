import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import KioskEmployee from "@/pages/KioskEmployee";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

const renderPage = (path = "/kiosk/employee/123456?device=AB12CD") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/kiosk/employee/:token" element={<KioskEmployee />} />
        <Route path="/kiosk-free" element={<div>kiosk-free</div>} />
      </Routes>
    </MemoryRouter>
  );

const okPayload = (status: "off" | "on" | "break") => ({
  data: {
    ok: true,
    device: { id: "d1", company_id: "c1", name: "Recepción" },
    employee: { id: "u1", full_name: "Ana Pérez", email: "ana@x.com" },
    status,
  },
  error: null,
});

describe("Kiosco libre: pantalla de empleado (/kiosk/employee/:code)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("resuelve PIN + código en una sola llamada de servidor", async () => {
    rpc.mockResolvedValue(okPayload("off"));
    renderPage();
    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("kiosk_employee_by_code", { p_pin: "AB12CD", p_code: "123456" });
    expect(screen.getByText("Dispositivo: Recepción")).toBeInTheDocument();
  });

  it("fuera de turno → solo puede fichar Entrada", async () => {
    rpc.mockResolvedValue(okPayload("off"));
    renderPage();
    expect(await screen.findByText("Fuera de turno")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrada/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salida/i })).toBeNull();
  });

  it("trabajando → puede hacer Pausa o Salida, no Entrada (antes siempre salía 'Fuera de turno')", async () => {
    rpc.mockResolvedValue(okPayload("on"));
    renderPage();
    expect(await screen.findByText("Trabajando")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pausa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /salida/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^entrada$/i })).toBeNull();
  });

  it("en pausa → ofrece Reanudar", async () => {
    rpc.mockResolvedValue(okPayload("break"));
    renderPage();
    expect(await screen.findByText("En pausa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reanudar/i })).toBeInTheDocument();
  });

  it("código de otra empresa → no muestra al empleado", async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: "not_member" }, error: null });
    renderPage();
    expect(await screen.findByText("No encontramos el empleado.")).toBeInTheDocument();
  });

  it("sin PIN de dispositivo en la URL no llama al servidor", async () => {
    renderPage("/kiosk/employee/123456");
    expect(await screen.findByText("No encontramos el empleado.")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });
});
