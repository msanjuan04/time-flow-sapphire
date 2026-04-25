import type { ComponentType } from "react";
import type { ProviderInfo } from "./providerInfo";

export interface CompanyLegalData {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  legal_address: string | null;
  legal_representative_name: string | null;
  legal_representative_id: string | null;
  contact_email: string | null;
}

export interface LegalDocContext {
  provider: ProviderInfo;
  company: CompanyLegalData;
  todayLabel: string;
}

export interface LegalDoc {
  id: string;
  title: string;
  description: string;
  /** Set true if the doc requires the company legal info to be filled. */
  requiresCompanyLegal: boolean;
  Component: ComponentType<{ ctx: LegalDocContext }>;
}
