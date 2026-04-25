import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import { QRCodeSVG } from "qrcode.react";
import {
  signReport,
  buildVerifyUrl,
  type SignReportRequest,
  type SignReportResponse,
} from "@/lib/signedReport";

interface Props {
  /** Company UUID */
  companyId: string;
  /** Period start (YYYY-MM-DD) */
  periodStart: string;
  /** Period end (YYYY-MM-DD) */
  periodEnd: string;
  /** HTML to embed in the certified PDF (the content you already render for the regular PDF) */
  reportHtml: string;
  /** Raw data hashed and stored in DB. Should be deterministic for the same period. */
  payload: any;
  /** Optional: 'company' (default) or 'user' */
  scope?: "company" | "user";
  /** If scope='user', the target user UUID */
  userId?: string | null;
  /** Optional report type label, default 'jornadas' */
  reportType?: string;
  /** Optional company display name for footer */
  companyName?: string;
  /** Disabled when there is no data */
  disabled?: boolean;
}

/**
 * Button that:
 *  1. Calls the `sign-report` edge function with the report payload.
 *  2. Receives the signature, hash and verification token.
 *  3. Generates a PDF that embeds: the original HTML + a QR pointing to the
 *     public verify page + a footer with hash/signature/signer.
 */
export function CertifiedReportButton({
  companyId,
  periodStart,
  periodEnd,
  reportHtml,
  payload,
  scope = "company",
  userId = null,
  reportType = "jornadas",
  companyName,
  disabled = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState<SignReportResponse | null>(null);
  // Hidden container used to render the QR via qrcode.react and capture as SVG.
  const qrHostRef = useRef<HTMLDivElement | null>(null);

  const handleClick = async () => {
    if (busy) return;
    if (!companyId || !periodStart || !periodEnd || !reportHtml) {
      toast.error("Faltan datos para firmar el informe");
      return;
    }

    setBusy(true);
    const t = toast.loading("Firmando informe…");
    try {
      const req: SignReportRequest = {
        company_id: companyId,
        scope,
        user_id: scope === "user" ? userId ?? null : null,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        payload,
      };

      const sig = await signReport(req);
      setSignature(sig);

      // Build certified HTML: original report + verification block (QR + hash).
      const verifyUrl = buildVerifyUrl(sig.verification_token);
      const qrSvg = await renderQrSvg(verifyUrl);

      const certifiedHtml = buildCertifiedHtml({
        reportHtml,
        qrSvg,
        verifyUrl,
        contentHash: sig.content_hash,
        signature: sig.signature,
        signedByEmail: sig.signed_by_email,
        generatedAt: sig.generated_at,
        token: sig.verification_token,
        companyName,
        reportType,
        periodStart,
        periodEnd,
      });

      const filename = `informe-certificado-${periodStart}_${periodEnd}.pdf`;
      const options = {
        margin: 10,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(options).from(certifiedHtml).save();

      toast.success("Informe certificado generado", { id: t });
    } catch (err: any) {
      console.error("CertifiedReport error:", err);
      toast.error(err?.message || "No pudimos generar el informe certificado", {
        id: t,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="default"
        onClick={handleClick}
        disabled={busy || disabled}
        className="gap-2"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ShieldCheck className="w-4 h-4" />
        )}
        {busy ? "Firmando…" : "Generar PDF certificado"}
      </Button>

      {/* Hidden host so qrcode.react can render to SVG; we never display it. */}
      <div ref={qrHostRef} style={{ display: "none" }}>
        {signature ? (
          <QRCodeSVG
            id={`qr-${signature.verification_token}`}
            value={buildVerifyUrl(signature.verification_token)}
            size={160}
            level="M"
          />
        ) : null}
      </div>
    </>
  );
}

/**
 * Render the QR off-DOM to a serialized SVG string. We instantiate a temporary
 * QR via qrcode.react by mounting it transiently — but to keep this synchronous
 * and avoid React mount races we use a lightweight approach: render via the
 * QRCodeSVG component by writing it into a detached container with ReactDOM…
 * Actually simplest: use a public SVG QR generator via fetch.
 */
async function renderQrSvg(value: string): Promise<string> {
  // Use api.qrserver.com (free, returns SVG, CORS-enabled).
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
    value
  )}&size=200x200&format=svg&margin=0`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("qr fetch failed");
    const svg = await res.text();
    return svg;
  } catch {
    // Fallback: embed as <img> pointing at PNG version (html2canvas with useCORS).
    const png = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
      value
    )}&size=200x200&format=png&margin=0`;
    return `<img src="${png}" alt="QR" width="160" height="160" crossorigin="anonymous" />`;
  }
}

interface CertifiedHtmlOpts {
  reportHtml: string;
  qrSvg: string;
  verifyUrl: string;
  contentHash: string;
  signature: string;
  signedByEmail: string;
  generatedAt: string;
  token: string;
  companyName?: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
}

function buildCertifiedHtml(o: CertifiedHtmlOpts): string {
  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("es-ES", {
        dateStyle: "long",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  // We wrap the existing report HTML with a "certified" header and footer.
  // The existing reportHtml already contains <html><head><style>…</style></head><body>…</body></html>
  // We need to inject the certification block at the beginning of the body and at the end.
  // To stay safe we just append our certified block as a separate page after the existing HTML.
  const certBlock = `
    <div style="page-break-before: always; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111;">
      <div style="border: 2px solid #0f766e; border-radius: 12px; padding: 24px; background: #f0fdfa;">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
          <div style="font-size: 28px;">🛡️</div>
          <div>
            <div style="font-size: 20px; font-weight: 700; color: #0f766e;">
              Informe certificado
            </div>
            <div style="font-size: 12px; color: #475569;">
              Firmado digitalmente con HMAC-SHA256
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: start;">
          <div style="font-size: 12px; line-height: 1.6; color: #1f2937;">
            ${o.companyName ? `<div><strong>Empresa:</strong> ${escape(o.companyName)}</div>` : ""}
            <div><strong>Tipo de informe:</strong> ${escape(o.reportType)}</div>
            <div><strong>Periodo:</strong> ${escape(o.periodStart)} → ${escape(o.periodEnd)}</div>
            <div><strong>Generado el:</strong> ${escape(fmtDate(o.generatedAt))}</div>
            <div><strong>Generado por:</strong> ${escape(o.signedByEmail)}</div>
            <div style="margin-top: 12px;">
              <strong>Verificable en:</strong><br/>
              <span style="font-family: monospace; font-size: 11px; word-break: break-all;">
                ${escape(o.verifyUrl)}
              </span>
            </div>
          </div>
          <div style="text-align: center;">
            ${o.qrSvg}
            <div style="font-size: 10px; color: #475569; margin-top: 4px;">
              Escanea para verificar
            </div>
          </div>
        </div>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #cbd5e1;" />

        <div style="font-size: 10px; font-family: monospace; color: #334155; line-height: 1.6;">
          <div><strong>SHA-256 (contenido):</strong><br/>${escape(o.contentHash)}</div>
          <div style="margin-top: 6px;"><strong>HMAC-SHA256 (firma):</strong><br/>${escape(o.signature)}</div>
          <div style="margin-top: 6px;"><strong>Token de verificación:</strong><br/>${escape(o.token)}</div>
        </div>

        <div style="margin-top: 18px; padding: 12px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 11px; color: #475569; line-height: 1.5;">
          Este documento ha sido firmado digitalmente. Cualquier modificación
          posterior invalidará la firma. Para verificar su autenticidad escanea
          el código QR o accede a la URL de verificación. La verificación se
          realiza recalculando el hash SHA-256 del contenido y comparándolo
          con la firma HMAC almacenada en el sistema.
        </div>
      </div>
    </div>
  `;

  // Insert certBlock before the closing </body> if present, else append.
  if (o.reportHtml.includes("</body>")) {
    return o.reportHtml.replace("</body>", `${certBlock}</body>`);
  }
  return o.reportHtml + certBlock;
}

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default CertifiedReportButton;
