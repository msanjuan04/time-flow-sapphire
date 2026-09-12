import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShiftEditorSheet, type ShiftEditorTarget } from "@/components/owner/ShiftEditorSheet";
import { emptyDraft, type RosterSchedule } from "@/lib/roster";

const lunes = new Date(2026, 8, 14); // semana del 14 al 20 de septiembre de 2026

const turno: RosterSchedule = {
  user_id: "ana",
  date: "2026-09-14",
  start_time: "09:00:00",
  end_time: "20:00:00",
  morning_end_time: "14:00:00",
  afternoon_start_time: "16:00:00",
  expected_hours: 9,
};

const target = (over: Partial<ShiftEditorTarget> = {}): ShiftEditorTarget => ({
  userId: "ana",
  name: "Ana Pérez",
  date: "2026-09-14",
  schedule: null,
  ...over,
});

const setup = (over: Partial<ShiftEditorTarget> = {}, suggestions = [{ ...emptyDraft(), start: "09:00", end: "17:00" }]) => {
  const onSave = vi.fn();
  const onRemove = vi.fn();
  render(
    <ShiftEditorSheet
      target={target(over)}
      weekStart={lunes}
      suggestions={suggestions}
      saving={false}
      onClose={vi.fn()}
      onSave={onSave}
      onRemove={onRemove}
    />
  );
  return { onSave, onRemove, user: userEvent.setup() };
};

describe("editor de turno del cuadrante", () => {
  it("abre con el turno que ya tenía esa persona ese día", () => {
    setup({ schedule: turno });
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByLabelText("Entrada")).toHaveValue("09:00");
    expect(screen.getByLabelText("Salida")).toHaveValue("20:00");
    expect(screen.getByLabelText("Sale a mediodía")).toHaveValue("14:00");
    expect(screen.getByText("9 h de jornada")).toBeInTheDocument();
  });

  it("un día libre no deja guardar hasta poner las horas", async () => {
    const { user } = setup();
    const guardar = screen.getByRole("button", { name: "Guardar turno" });
    expect(guardar).toBeDisabled();
    expect(screen.getByText(/Pon la hora de entrada/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "09:00 - 17:00" }));
    expect(screen.getByText("8 h de jornada")).toBeInTheDocument();
    expect(guardar).toBeEnabled();
  });

  it("guarda solo el día que se estaba editando", async () => {
    const { onSave, user } = setup();
    await user.click(screen.getByRole("button", { name: "09:00 - 17:00" }));
    await user.click(screen.getByRole("button", { name: "Guardar turno" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ start: "09:00", end: "17:00" }),
      ["2026-09-14"]
    );
  });

  it("permite dejar el mismo turno en varios días de la semana", async () => {
    const { onSave, user } = setup();
    await user.click(screen.getByRole("button", { name: "09:00 - 17:00" }));
    // Los botones de día son L M X J V S D con el número del mes debajo.
    await user.click(screen.getByRole("button", { name: /^M15$/ }));
    await user.click(screen.getByRole("button", { name: /^X16$/ }));
    await user.click(screen.getByRole("button", { name: "Guardar en 3 días" }));
    expect(onSave).toHaveBeenCalledWith(expect.anything(), ["2026-09-14", "2026-09-15", "2026-09-16"]);
  });

  it("el turno partido añade los dos tramos y descuenta la comida", async () => {
    const { onSave, user } = setup();
    await user.click(screen.getByRole("button", { name: "09:00 - 17:00" }));
    await user.click(screen.getByRole("switch", { name: /Turno partido/i }));
    expect(screen.getByText("6 h de jornada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar turno" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ morningEnd: "14:00", afternoonStart: "16:00" }),
      ["2026-09-14"]
    );
  });

  it("solo ofrece dejar el día libre si había turno", async () => {
    const { onRemove, user } = setup({ schedule: turno });
    await user.click(screen.getByRole("button", { name: /Dejar el día libre/ }));
    expect(onRemove).toHaveBeenCalledWith(["2026-09-14"]);
  });

  it("sin turno guardado no aparece el botón de dejar libre", () => {
    setup();
    expect(screen.queryByText(/Dejar el día libre/)).not.toBeInTheDocument();
  });
});
