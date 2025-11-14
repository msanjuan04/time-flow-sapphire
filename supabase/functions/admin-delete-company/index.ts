import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";
import { validateUUID, validateLength, createValidationErrorResponse, ValidationError } from "../_shared/validation.ts";

interface DeleteCompanyRequest {
  company_id?: string;
  company_name_confirm?: string; // Requerido: el usuario debe escribir el nombre exacto para confirmar
  reason?: string;
}

/**
 * Deletes all files in the exports bucket for a given company
 */
async function deleteCompanyExports(supabase: any, companyId: string): Promise<number> {
  try {
    // List all files in the exports bucket for this company
    const { data: files, error: listError } = await supabase.storage
      .from("exports")
      .list(`${companyId}/`, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      console.warn("Error listing exports for company:", listError);
      return 0;
    }

    if (!files || files.length === 0) {
      return 0;
    }

    // Delete all files
    const filePaths = files.map((file: any) => `${companyId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from("exports")
      .remove(filePaths);

    if (deleteError) {
      console.warn("Error deleting exports:", deleteError);
      return 0;
    }

    return filePaths.length;
  } catch (error) {
    console.warn("Error in deleteCompanyExports:", error);
    return 0;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase, user } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);
    const body: DeleteCompanyRequest = await req.json().catch(() => ({}));
    const errors: ValidationError[] = [];

    validateUUID(body.company_id, "company_id", errors, true);
    
    // Require company name confirmation
    if (!body.company_name_confirm || typeof body.company_name_confirm !== "string") {
      errors.push({
        field: "company_name_confirm",
        message: "Company name confirmation is required for safety",
      });
    }
    
    if (body.reason) {
      validateLength(body.reason, "reason", 3, 500, errors, false);
    }

    if (errors.length > 0) {
      return createValidationErrorResponse(errors, corsHeaders);
    }

    // Fetch company to verify it exists and get its name
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name, plan, status")
      .eq("id", body.company_id)
      .single();

    if (companyError || !company) {
      console.error("Company not found:", companyError);
      return createErrorResponse("Company not found", 404);
    }

    // Verify that the confirmed name matches exactly
    const confirmedName = (body.company_name_confirm || "").trim();
    if (confirmedName !== company.name) {
      return createErrorResponse(
        `Company name confirmation does not match. Expected: "${company.name}", Got: "${confirmedName}"`,
        400
      );
    }

    // Delete files from exports bucket before deleting the company
    const deletedFilesCount = await deleteCompanyExports(supabase, company.id);
    console.log(`Deleted ${deletedFilesCount} files from exports bucket for company ${company.id}`);

    // Delete all invites (emails) associated with the company
    const { data: invites, error: invitesListError } = await supabase
      .from("invites")
      .select("id, email, status")
      .eq("company_id", company.id);

    let deletedInvitesCount = 0;
    if (!invitesListError && invites && invites.length > 0) {
      const { error: deleteInvitesError } = await supabase
        .from("invites")
        .delete()
        .eq("company_id", company.id);

      if (deleteInvitesError) {
        console.warn("Error deleting invites:", deleteInvitesError);
      } else {
        deletedInvitesCount = invites.length;
        console.log(`Deleted ${deletedInvitesCount} invites (emails) for company ${company.id}`);
      }
    }

    // Delete the company (CASCADE will handle other related records)
    const { error: deleteError } = await supabase
      .from("companies")
      .delete()
      .eq("id", body.company_id);

    if (deleteError) {
      console.error("Failed to delete company:", deleteError);
      return createErrorResponse("Failed to delete company", 500);
    }

    // Write audit log
    await writeAudit(supabase, {
      company_id: company.id,
      actor_user_id: user.id,
      action: "admin_delete_company",
      entity_type: "company",
      entity_id: company.id,
      diff: {
        deleted_company: {
          id: company.id,
          name: company.name,
          status: company.status,
          plan: company.plan,
        },
        deleted_files_count: deletedFilesCount,
        deleted_invites_count: deletedInvitesCount,
        deleted_invites_emails: invites?.map((inv: any) => inv.email) || [],
      },
      ip,
      user_agent,
      reason: body.reason || "Company removed by superadmin",
    });

    console.log(`Superadmin ${user.id} deleted company ${company.id} (${company.name})`);

    return createJsonResponse({
      success: true,
      deleted_company_id: company.id,
      deleted_company_name: company.name,
      deleted_files_count: deletedFilesCount,
      deleted_invites_count: deletedInvitesCount,
    });
  } catch (error) {
    console.error("Delete company error:", error);
    
    const message = error instanceof Error ? error.message : "Failed to delete company";
    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to delete company", 500);
  }
});
