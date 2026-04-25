/**
 * Datos legales del proveedor del servicio (GNERAI / GTIQ).
 * GNERAI actúa siempre como ENCARGADO DEL TRATAMIENTO RGPD.
 * No editar sin consultar — afecta a todos los documentos legales generados.
 */
export const PROVIDER_INFO = {
  brand: "GNERAI",
  product: "GTIQ",
  legalName: "Marc Cortada Roca",
  taxId: "39946747W",
  address: "C/ Unió 90, 3-1, 08302 Mataró",
  contactEmail: "gnerai@gneraitiq.com",
  website: "https://gneraitiq.com",
} as const;

export type ProviderInfo = typeof PROVIDER_INFO;
