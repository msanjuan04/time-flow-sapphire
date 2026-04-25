import DocumentLayout from "../DocumentLayout";
import type { LegalDocContext } from "../types";

const ClausulaInformativaRgpd = ({ ctx }: { ctx: LegalDocContext }) => {
  const { company } = ctx;
  const empresa = company.legal_name || company.name;
  return (
    <DocumentLayout ctx={ctx} title="Cláusula informativa de protección de datos">
      <p>
        En cumplimiento del Reglamento (UE) 2016/679 (RGPD) y de la Ley Orgánica
        3/2018, de 5 de diciembre (LOPDGDD), se informa al trabajador del
        tratamiento de sus datos personales en el siguiente sentido:
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Responsable del tratamiento</h2>
      <p>
        <strong>{empresa}</strong>
        {company.tax_id ? <>, NIF/CIF {company.tax_id}</> : null}
        {company.legal_address ? <>, con domicilio en {company.legal_address}</> : null}
        {company.contact_email ? <>. Contacto: {company.contact_email}.</> : "."}
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Encargado del tratamiento</h2>
      <p>
        <strong>{ctx.provider.brand}</strong> ({ctx.provider.legalName}, NIF{" "}
        {ctx.provider.taxId}, con domicilio en {ctx.provider.address}, contacto{" "}
        {ctx.provider.contactEmail}), proveedor de la plataforma{" "}
        {ctx.provider.product}.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Finalidades</h2>
      <ul>
        <li>Gestión del registro horario obligatorio (art. 34.9 ET).</li>
        <li>Control de cumplimiento de jornada, pausas y descansos.</li>
        <li>Elaboración de informes laborales y nóminas.</li>
        <li>
          Detección de incidencias o anomalías en los fichajes y comunicación con el
          trabajador para su corrección.
        </li>
      </ul>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Base jurídica</h2>
      <p>
        Cumplimiento de obligaciones legales del responsable (art. 6.1.c RGPD) y
        ejecución del contrato laboral (art. 6.1.b RGPD).
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Categorías de datos</h2>
      <ul>
        <li>Identificativos: nombre, DNI, email corporativo.</li>
        <li>Profesionales: puesto, centro, equipo, horario asignado.</li>
        <li>De fichaje: hora, dispositivo, IP, fuente y opcionalmente coordenadas
          de geolocalización limitadas al instante del fichaje.</li>
      </ul>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Conservación</h2>
      <p>
        Los datos del registro horario se conservarán durante <strong>4 años</strong>
        conforme al RD-Ley 8/2019. El resto de datos durante la vigencia de la
        relación laboral y los plazos legales de prescripción aplicables.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Destinatarios</h2>
      <p>
        Los datos no se ceden a terceros salvo obligación legal (Inspección de
        Trabajo, Seguridad Social, Hacienda) o a los encargados del tratamiento que
        prestan servicios de soporte tecnológico bajo el correspondiente contrato.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Derechos</h2>
      <p>
        El trabajador puede ejercer sus derechos de acceso, rectificación,
        supresión, oposición, limitación y portabilidad dirigiéndose por escrito a
        {company.contact_email ? <> <strong>{company.contact_email}</strong></> : <> el responsable</>}.
        Asimismo, puede presentar reclamación ante la Agencia Española de Protección
        de Datos (www.aepd.es).
      </p>

      <p style={{ marginTop: "10mm" }}>
        El trabajador declara haber sido informado del tratamiento de sus datos
        personales en los términos arriba expuestos.
      </p>

      <table
        style={{
          width: "100%",
          marginTop: "10mm",
          borderCollapse: "collapse",
          fontSize: "10pt",
        }}
      >
        <tbody>
          <tr>
            <td style={{ width: "50%", padding: "4mm", verticalAlign: "top" }}>
              <p style={{ margin: 0 }}><strong>El trabajador</strong></p>
              <p style={{ marginTop: "16mm" }}>
                Nombre: ____________________<br />
                DNI: ____________________<br />
                Fecha y firma:
              </p>
            </td>
            <td style={{ width: "50%", padding: "4mm", verticalAlign: "top" }}>
              <p style={{ margin: 0 }}><strong>Por la empresa</strong></p>
              <p style={{ marginTop: "16mm" }}>
                {company.legal_representative_name || "____________________"}<br />
                {company.legal_representative_id || "____________________"}<br />
                Firma:
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </DocumentLayout>
  );
};

export default ClausulaInformativaRgpd;
