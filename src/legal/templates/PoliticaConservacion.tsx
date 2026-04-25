import DocumentLayout from "../DocumentLayout";
import type { LegalDocContext } from "../types";

const PoliticaConservacion = ({ ctx }: { ctx: LegalDocContext }) => {
  const empresa = ctx.company.legal_name || ctx.company.name;
  return (
    <DocumentLayout ctx={ctx} title="Política de conservación de los registros de jornada">
      <p>
        En cumplimiento de la disposición adicional tercera del Real Decreto-ley
        8/2019, <strong>{empresa}</strong> establece la siguiente política interna
        de conservación de los registros horarios de su plantilla.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>1. Periodo de conservación</h2>
      <p>
        Los registros diarios de jornada se conservarán durante un periodo mínimo
        de <strong>cuatro (4) años</strong> desde la fecha de su generación.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>2. Acceso</h2>
      <p>Los registros estarán a disposición de:</p>
      <ul>
        <li>Las personas trabajadoras (acceso a los suyos propios).</li>
        <li>Sus representantes legales.</li>
        <li>La Inspección de Trabajo y Seguridad Social.</li>
      </ul>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>3. Soporte</h2>
      <p>
        Los registros se conservan en formato electrónico dentro de la plataforma{" "}
        {ctx.provider.product}, operada por {ctx.provider.brand}, con copias de
        seguridad periódicas y trazabilidad de cambios mediante registros de
        auditoría.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>4. Eliminación</h2>
      <p>
        Transcurrido el plazo de conservación, los registros serán eliminados de
        forma segura, sin posibilidad de recuperación, salvo que estén afectados
        por alguna causa legal de conservación adicional (procedimientos
        judiciales, inspección activa, etc.).
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>5. Responsable</h2>
      <p>
        La supervisión del cumplimiento de esta política corresponde a{" "}
        {ctx.company.legal_representative_name || "la dirección de la empresa"}
        {ctx.company.contact_email ? <> ({ctx.company.contact_email})</> : null}.
      </p>

      <p style={{ marginTop: "12mm", textAlign: "right" }}>
        En {ctx.company.legal_address || "________________"}, a {ctx.todayLabel}.
      </p>
    </DocumentLayout>
  );
};

export default PoliticaConservacion;
