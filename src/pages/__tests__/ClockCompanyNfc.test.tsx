import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ClockCompanyNfcPage from "@/pages/ClockCompanyNfc";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));
vi.mock("@/lib/kioskSounds", () => ({
  playKioskSound: vi.fn(),
  primeKioskAudio: vi.fn(),
}));

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
const COMPANY = "686460ff-173e-4090-b75b-72aa8bf78079";
const CARD = "53:AE:93:AF:A1:00:01";

const renderKiosk = (companyId = COMPANY) =>
  render(
    <MemoryRouter initialEntries={[`/clock/${companyId}/nfc`]}>
      <Routes>
        <Route path="/clock/:companyId/nfc" element={<ClockCompanyNfcPage />} />
      </Routes>
    </MemoryRouter>
  );

/** Simula el lector USB: escribe el UID en el input oculto y pulsa Enter. */
const tapCard = async (uid: string) => {
  await screen.findByText("Pasa tu tarjeta para fichar");
  const input = document.querySelector("input") as HTMLInputElement;
  fireEvent.change(input, { target: { value: uid } });
  fireEvent.keyDown(input, { key: "Enter" });
};

describe("Kiosco NFC por empresa (/clock/:companyId/nfc)", () => {
  beforeEach(() => {
    rpc.mockReset();
    window.localStorage.clear();
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    // Comprobación inicial de empresa: uid vacío → empty_uid → pantalla de espera
    rpc.mockResolvedValue({ data: { ok: false, error: "empty_uid" }, error: null });
  });

  it("al cargar comprueba la empresa y espera tarjeta", async () => {
    renderKiosk();
    expect(await screen.findByText("Pasa tu tarjeta para fichar")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("nfc_kiosk_clock", { p_company_id: COMPANY, p_raw_uid: "" });
  });

  it("una empresa inexistente muestra el error y no acepta tarjetas", async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: "company_not_found" }, error: null });
    renderKiosk();
    expect(await screen.findByText("Empresa no encontrada")).toBeInTheDocument();
  });

  it("un id de empresa que no es UUID no llega a llamar al servidor", async () => {
    renderKiosk("santa-marta");
    expect(await screen.findByText("Enlace no válido")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("primera pasada → entrada con el nombre del trabajador", async () => {
    renderKiosk();
    rpc.mockResolvedValueOnce({ data: { ok: true, action: "clock_in", nombre_completo: "Ana Pérez" }, error: null });
    await tapCard(CARD);
    expect(await screen.findByText("Bienvenido, Ana Pérez")).toBeInTheDocument();
    const call = rpc.mock.calls.find((c) => c[1]?.p_raw_uid === CARD);
    expect(call).toBeTruthy();
    expect(call![1].p_company_id).toBe(COMPANY);
    expect(typeof call![1].p_event_time).toBe("string");
  });

  it("segunda pasada → salida", async () => {
    renderKiosk();
    rpc.mockResolvedValueOnce({ data: { ok: true, action: "clock_out", nombre_completo: "Ana Pérez" }, error: null });
    await tapCard(CARD);
    expect(await screen.findByText("Hasta pronto, Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("Salida registrada correctamente")).toBeInTheDocument();
  });

  it("tarjeta desconocida → aviso claro y vuelta a esperar", async () => {
    renderKiosk();
    rpc.mockResolvedValueOnce({ data: { ok: false, error: "unknown_card" }, error: null });
    await tapCard("00:11:22:33");
    expect(await screen.findByText("Tarjeta no reconocida")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Pasa tu tarjeta para fichar")).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it("trabajador de baja médica → bloqueo con mensaje", async () => {
    renderKiosk();
    rpc.mockResolvedValueOnce({
      data: { ok: false, error: "on_sick_leave", nombre_completo: "Luis", message: "Estás de baja aprobada." },
      error: null,
    });
    await tapCard(CARD);
    expect(await screen.findByText("Luis, estás de baja")).toBeInTheDocument();
    expect(screen.getByText("Estás de baja aprobada.")).toBeInTheDocument();
  });

  it("sin conexión guarda la pasada y lo dice en pantalla", async () => {
    renderKiosk();
    await screen.findByText("Pasa tu tarjeta para fichar");
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    await tapCard(CARD);
    expect(await screen.findByText("Guardado sin conexión")).toBeInTheDocument();
    const queue = JSON.parse(window.localStorage.getItem("offline_nfc_queue_v1") || "[]");
    expect(queue).toHaveLength(1);
    expect(queue[0].rawUid).toBe(CARD);
  });
});
