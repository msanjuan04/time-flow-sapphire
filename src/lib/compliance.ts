import { supabase } from "@/integrations/supabase/client";

export interface ComplianceSettings {
  id: string;
  company_id: string;
  max_week_hours: number | null;
  max_month_hours: number | null;
  min_hours_between_shifts: number | null;
  allowed_checkin_start: string | null; // HH:MM:SS
  allowed_checkin_end: string | null;   // HH:MM:SS
  allow_outside_schedule: boolean | null;
  created_at: string;
  updated_at: string;
}

export const getComplianceSettings = async (companyId: string) => {
  const { data, error } = await supabase
    .from("company_compliance_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data as ComplianceSettings | null;
};

export const updateComplianceSettings = async (
  companyId: string,
  payload: Partial<ComplianceSettings>
) => {
  const { data, error } = await supabase.rpc("set_compliance_settings", {
    _company_id: companyId,
    _max_week_hours: payload.max_week_hours ?? null,
    _max_month_hours: payload.max_month_hours ?? null,
    _min_hours_between_shifts: payload.min_hours_between_shifts ?? null,
    _allowed_checkin_start: payload.allowed_checkin_start ?? null,
    _allowed_checkin_end: payload.allowed_checkin_end ?? null,
    _allow_outside_schedule: payload.allow_outside_schedule ?? false,
  });

  if (error) throw error;
  return data as ComplianceSettings;
};
