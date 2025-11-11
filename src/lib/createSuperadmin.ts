import { supabase } from "@/integrations/supabase/client";

export const createSuperadminAccount = async (
  email: string,
  password: string,
  fullName?: string
) => {
  try {
    const { data, error } = await supabase.functions.invoke(
      "admin-create-superadmin",
      {
        body: { email, password, fullName },
      }
    );

    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    console.error("Error creating superadmin:", error);
    return { data: null, error };
  }
};
