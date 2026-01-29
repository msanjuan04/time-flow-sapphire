import { describe, it, expect } from "vitest";
import { getPreviousMonth, getWeeksForMonth } from "./month";

describe("getWeeksForMonth", () => {
  it("returns ISO weeks covering February 2026 (lunes-domingo)", () => {
    const weeks = getWeeksForMonth(2026, 2);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toMatchObject({
      weekStartDate: "2026-01-26",
      weekEndDate: "2026-02-01",
      crossesMonth: true,
    });
    expect(weeks[weeks.length - 1]).toMatchObject({
      weekStartDate: "2026-02-23",
      weekEndDate: "2026-03-01",
      crossesMonth: true,
    });
    expect(weeks[1].label).toContain("Semana 2");
  });
});

describe("getPreviousMonth", () => {
  it("wraps from January to December of previous year", () => {
    expect(getPreviousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(getPreviousMonth(2026, 3)).toEqual({ year: 2026, month: 2 });
  });
});
