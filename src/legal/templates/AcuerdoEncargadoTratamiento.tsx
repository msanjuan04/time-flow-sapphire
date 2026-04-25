import DocumentLayout from "../DocumentLayout";
import type { LegalDocContext } from "../types";

const AcuerdoEncargadoTratamiento = ({ ctx }: { ctx: LegalDocContext }) => {
  const { company, provider } = ctx;
  const empresa = company.legal_name || company.name;
  return (
    <DocumentLayout
      ctx={ctx}
      title="Contrato de encargado del tratamiento (art. 28 RGPD)"
    >
      <p>En {company.legal_address || "________________"}, a {ctx.todayLabel}.</p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Reunidos</h2>
      <p>
        <strong>De una parte, el RESPONSABLE DEL TRATAMIENTO:</strong>{" "}
        <strong>{empresa}</strong>
        {company.tax_id ? <>, con NIF/CIF {company.tax_id}</> : null}
        {company.legal_address ? <>, domicilio en {company.legal_address}</> : null},
        representada por <strong>{company.legal_representative_name || "________________"}</strong>
        {company.legal_representative_id ? <> (DNI {company.legal_representative_id})</> : null}.
      </p>
      <p>
        <strong>De otra parte, el ENCARGADO DEL TRATAMIENTO:</strong>{" "}
        <strong>{provider.brand}</strong>, marca comercial de{" "}
        <strong>{provider.legalName}</strong>, NIF {provider.taxId}, con domicilio en{" "}
        {provider.address}, en su condición de proveedor de la plataforma{" "}
        {provider.product}.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Exponen</h2>
      <p>
        Que ambas partes han suscrito un contrato de prestación de servicios en
        virtud del cual el Encargado tratará por cuenta del Responsable los datos
        personales necesarios para el funcionamiento del sistema de registro horario
        y gestión laboral. Las partes acuerdan formalizar las garantías exigidas por
        el artículo 28 del RGPD mediante las siguientes
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>Cláusulas</h2>

      <p>
        <strong>1. Objeto.</strong> Regular el tratamiento de datos personales por
        el Encargado por cuenta del Responsable, en el marco de la prestación del
        servicio {provider.product}.
      </p>

      <p>
        <strong>2. Duración.</strong> Mientras esté vigente la prestación del
        servicio. A su finalización, el Encargado devolverá o eliminará los datos
        en el plazo máximo de 30 días, salvo obligación legal de conservación.
      </p>

      <p>
        <strong>3. Naturaleza y finalidad del tratamiento.</strong> Alojamiento,
        procesado y consulta de datos de fichaje, identificación de trabajadores,
        horarios, ausencias, geolocalización en el instante del fichaje (cuando
        proceda) e informes laborales asociados.
      </p>

      <p>
        <strong>4. Tipos de datos.</strong> Identificativos, profesionales, de
        registro horario y, en su caso, de geolocalización puntual.
      </p>

      <p>
        <strong>5. Categorías de interesados.</strong> Trabajadores y personal
        autorizado del Responsable.
      </p>

      <p>
        <strong>6. Obligaciones del Encargado.</strong> El Encargado se obliga a:
      </p>
      <ul>
        <li>Tratar los datos únicamente conforme a las instrucciones documentadas
          del Responsable.</li>
        <li>Garantizar la confidencialidad del personal autorizado.</li>
        <li>Implantar medidas técnicas y organizativas apropiadas (cifrado en
          tránsito y en reposo, control de acceso por roles, registros de
          auditoría, copias de seguridad).</li>
        <li>No subcontratar tratamientos sin autorización previa del Responsable,
          salvo los proveedores de infraestructura ya conocidos por éste.</li>
        <li>Asistir al Responsable en el ejercicio de derechos de los interesados.</li>
        <li>Notificar al Responsable, sin dilación indebida y en un plazo máximo de
          72 horas, cualquier brecha de seguridad de la que tenga conocimiento.</li>
        <li>Devolver o eliminar los datos al término del servicio.</li>
        <li>Poner a disposición del Responsable la información necesaria para
          demostrar el cumplimiento de sus obligaciones.</li>
      </ul>

      <p>
        <strong>7. Subencargados.</strong> El Encargado puede apoyarse en
        proveedores de infraestructura cloud (alojamiento de bases de datos y
        funciones serverless) sujetos a obligaciones equivalentes a las recogidas
        en este contrato. Se mantendrá un registro actualizado a disposición del
        Responsable.
      </p>

      <p>
        <strong>8. Transferencias internacionales.</strong> Si los proveedores de
        infraestructura realizan tratamientos fuera del Espacio Económico Europeo,
        se aplicarán las garantías adecuadas previstas en el capítulo V del RGPD
        (cláusulas contractuales tipo aprobadas por la Comisión Europea).
      </p>

      <p>
        <strong>9. Responsabilidad.</strong> Cada parte responderá frente a los
        interesados y autoridades de control de los daños causados por el
        incumplimiento de sus respectivas obligaciones.
      </p>

      <p>
        <strong>10. Legislación aplicable.</strong> El presente contrato se rige por
        la legislación española y por el RGPD.
      </p>

      <p style={{ marginTop: "10mm" }}>
        Y en prueba de conformidad, ambas partes firman el presente contrato en el
        lugar y fecha indicados al inicio.
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
              <p style={{ margin: 0 }}><strong>El Responsable</strong></p>
              <p style={{ marginTop: "18mm" }}>
                {empresa}<br />
                {company.legal_representative_name || "____________________"}<br />
                {company.legal_representative_id ? `DNI ${company.legal_representative_id}` : "DNI ____________________"}
              </p>
            </td>
            <td style={{ width: "50%", padding: "4mm", verticalAlign: "top" }}>
              <p style={{ margin: 0 }}><strong>El Encargado</strong></p>
              <p style={{ marginTop: "18mm" }}>
                {provider.brand} ({provider.legalName})<br />
                NIF {provider.taxId}<br />
                {provider.contactEmail}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </DocumentLayout>
  );
};

export default AcuerdoEncargadoTratamiento;
