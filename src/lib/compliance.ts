import { supabase } from "@/integrations/supabase/client";

export interface ComplianceSettings {
  id: string;
  company_id: string;
  max_week_hours: number | null;
  max_month_hours: number | null;
  min_hours_between_shifts: number | null;
  allowed_checkin_start: string | null; // HH:MM:SS
  allowed_checkin_end: string | null;   // HH:MM:SS
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
  const { data, error } = await supabase
    .from("company_compliance_settings")
    .upsert({
      company_id: companyId,
      ...payload,
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as ComplianceSettings;
};

