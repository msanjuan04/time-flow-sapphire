import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";
import { validateUUID, ValidationError, createValidationErrorResponse } from "../_shared/validation.ts";

interface TransferOwnershipRequest {
  company_id: string;
  new_owner_user_id: string;
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase, user } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);

    const body: TransferOwnershipRequest = await req.json();
    const errors: ValidationError[] = [];

    validateUUID(body.company_id, "company_id", errors, true);
    validateUUID(body.new_owner_user_id, "new_owner_user_id", errors, true);

    if (errors.length > 0) {
      return createValidationErrorResponse(errors, corsHeaders);
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name, owner_user_id")
      .eq("id", body.company_id)
      .single();

    if (companyError || !company) {
      return createErrorResponse("Company not found", 404);
    }

    // Verify new owner is a member of the company
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("id, role")
      .eq("company_id", body.company_id)
      .eq("user_id", body.new_owner_user_id)
      .single();

    if (membershipError || !membership) {
      return createErrorResponse("User is not a member of this company", 400);
    }

    // Verify new owner has admin or owner role
    if (!["admin", "owner"].includes(membership.role)) {
      return createErrorResponse("User must be an admin to become owner", 400);
    }

    const oldOwnerId = company.owner_user_id;

    // Update company owner
    const { error: updateCompanyError } = await supabase
      .from("companies")
      .update({ owner_user_id: body.new_owner_user_id })
      .eq("id", body.company_id);

    if (updateCompanyError) {
      console.error("Error updating company owner:", updateCompanyError);
      return createErrorResponse("Failed to update company owner", 500);
    }

    // Update new owner's membership role to 'owner'
    const { error: updateMembershipError } = await supabase
      .from("memberships")
      .update({ role: "owner" })
      .eq("company_id", body.company_id)
      .eq("user_id", body.new_owner_user_id);

    if (updateMembershipError) {
      console.error("Error updating membership:", updateMembershipError);
    }

    // If there was a previous owner, downgrade to admin
    if (oldOwnerId) {
      await supabase
        .from("memberships")
        .update({ role: "admin" })
        .eq("company_id", body.company_id)
        .eq("user_id", oldOwnerId);
    }

    // Write audit log
    await writeAudit(supabase, {
      company_id: body.company_id,
      actor_user_id: user.id,
      action: "admin.company.transfer_ownership",
      entity_type: "company",
      entity_id: body.company_id,
      diff: {
        old_owner_user_id: oldOwnerId,
        new_owner_user_id: body.new_owner_user_id,
      },
      ip,
      user_agent,
      reason: body.reason || "Ownership transferred by superadmin",
    });

    console.log(`Superadmin ${user.id} transferred ownership of company ${body.company_id}: ${oldOwnerId} -> ${body.new_owner_user_id}`);

    return createJsonResponse({
      success: true,
      message: "Ownership transferred successfully",
    });
  } catch (error) {
    console.error("Transfer ownership error:", error);

    const message = error instanceof Error ? error.message : "Failed to transfer ownership";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to transfer ownership", 500);
  }
});
