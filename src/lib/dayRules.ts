import { supabase } from "@/integrations/supabase/client";

export type HolidayPolicy = "allow" | "require_reason" | "block";
export type SpecialDayPolicy = "allow" | "restrict";

export interface CompanyDayRules {
  id: string;
  company_id: string;
  allow_sunday_clock: boolean;
  holiday_clock_policy: HolidayPolicy;
  special_day_policy: SpecialDayPolicy;
  created_at: string;
  updated_at: string;
}

export interface WorkerDayRules {
  id: string;
  company_id: string;
  user_id: string;
  allow_sunday_clock: boolean | null;
  holiday_clock_policy: HolidayPolicy | null;
  special_day_policy: SpecialDayPolicy | null;
  created_at: string;
  updated_at: string;
}

export const getCompanyDayRules = async (companyId: string) => {
  const { data, error } = await supabase
    .from("company_day_rules" as any)
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data as CompanyDayRules | null;
};

export const upsertCompanyDayRules = async (
  companyId: string,
  payload: Partial<Omit<CompanyDayRules, "id" | "company_id" | "created_at" | "updated_at">>
) => {
  const { data, error } = await supabase
    .from("company_day_rules" as any)
    .upsert(
      {
        company_id: companyId,
        ...payload,
      },
      { onConflict: "company_id" }
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as CompanyDayRules;
};

export const getWorkerDayRules = async (companyId: string) => {
  const { data, error } = await supabase
    .from("worker_day_rules" as any)
    .select("*")
    .eq("company_id", companyId);

  if (error) throw error;
  return (data || []) as WorkerDayRules[];
};

export const upsertWorkerDayRule = async (
  companyId: string,
  userId: string,
  payload: Partial<Omit<WorkerDayRules, "id" | "company_id" | "user_id" | "created_at" | "updated_at">>
) => {
  const { data, error } = await supabase
    .from("worker_day_rules" as any)
    .upsert(
      {
        company_id: companyId,
        user_id: userId,
        ...payload,
      },
      { onConflict: "company_id,user_id" }
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as WorkerDayRules;
};
