import type { ReactNode } from "react";
import type { LegalDocContext } from "./types";

interface Props {
  ctx: LegalDocContext;
  title: string;
  children: ReactNode;
}

/**
 * Wrapper visual común a todos los documentos legales.
 * Usa estilos inline para que html2pdf.js los respete sin depender de Tailwind.
 */
const DocumentLayout = ({ ctx, title, children }: Props) => {
  return (
    <div
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "11pt",
        lineHeight: 1.55,
        color: "#1a1a1a",
        maxWidth: "180mm",
        margin: "0 auto",
        padding: "16mm 16mm 20mm",
        background: "#fff",
      }}
    >
      <header
        style={{
          borderBottom: "2px solid #111",
          paddingBottom: "8mm",
          marginBottom: "10mm",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "8mm",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "9pt",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "#666",
              }}
            >
              Documento legal
            </p>
            <h1
              style={{
                margin: "2mm 0 0",
                fontSize: "18pt",
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {title}
            </h1>
          </div>
          <div style={{ textAlign: "right", fontSize: "9pt", color: "#444" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{ctx.provider.brand}</p>
            <p style={{ margin: 0 }}>{ctx.provider.product}</p>
            <p style={{ margin: 0 }}>{ctx.todayLabel}</p>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer
        style={{
          marginTop: "12mm",
          paddingTop: "5mm",
          borderTop: "1px solid #ccc",
          fontSize: "8pt",
          color: "#777",
          textAlign: "center",
        }}
      >
        Plantilla orientativa generada por {ctx.provider.brand} ({ctx.provider.product}).
        Revisa este documento con tu asesor legal antes de usarlo en producción. ·{" "}
        {ctx.provider.contactEmail}
      </footer>
    </div>
  );
};

export default DocumentLayout;
