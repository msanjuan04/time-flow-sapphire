import DocumentLayout from "../DocumentLayout";
import type { LegalDocContext } from "../types";

const RegistroHorarioInfo = ({ ctx }: { ctx: LegalDocContext }) => {
  const { company } = ctx;
  const empresa = company.legal_name || company.name;
  return (
    <DocumentLayout ctx={ctx} title="Información sobre el registro de jornada laboral">
      <p>
        En cumplimiento del artículo 34.9 del Estatuto de los Trabajadores
        (modificado por el Real Decreto-ley 8/2019, de 8 de marzo), <strong>{empresa}</strong>
        {company.tax_id ? <> (NIF/CIF {company.tax_id})</> : null} informa a su
        plantilla de la implantación de un sistema de registro horario diario de la
        jornada de trabajo.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>1. Finalidad</h2>
      <p>
        El registro horario tiene como finalidad garantizar el cumplimiento de los
        límites de jornada y descansos, así como dar cumplimiento a las obligaciones
        legales en materia de control horario.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>2. Sistema utilizado</h2>
      <p>
        La empresa utiliza la plataforma <strong>{ctx.provider.product}</strong>,
        operada por <strong>{ctx.provider.brand}</strong> ({ctx.provider.legalName},
        NIF {ctx.provider.taxId}, {ctx.provider.address}). El sistema permite el
        fichaje de entrada, salida y pausas mediante diferentes medios (web, móvil,
        kiosko, NFC) y registra fecha y hora de cada evento.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>3. Datos registrados</h2>
      <ul>
        <li>Identificación del trabajador.</li>
        <li>Fecha y hora de cada fichaje (entrada, salida, inicio y fin de pausa).</li>
        <li>Dispositivo o medio utilizado para fichar.</li>
        <li>
          Coordenadas de geolocalización <em>únicamente</em> cuando se utilicen puntos
          de fichaje con geovalla y siempre limitadas al momento del fichaje.
        </li>
      </ul>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>4. Conservación</h2>
      <p>
        Los registros se conservarán durante <strong>cuatro (4) años</strong> a
        disposición de los trabajadores, sus representantes legales y de la
        Inspección de Trabajo y Seguridad Social, conforme a la disposición
        adicional tercera del RD-Ley 8/2019.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>5. Derechos</h2>
      <p>
        El trabajador tiene derecho a acceder en cualquier momento a los registros
        de su propia jornada y a solicitar correcciones cuando detecte errores. Para
        ello podrá utilizar la propia plataforma o dirigirse a
        {company.contact_email ? <> <strong>{company.contact_email}</strong></> : <> el departamento de RR. HH.</>}.
      </p>

      <h2 style={{ fontSize: "13pt", marginTop: "8mm" }}>6. Recibí del trabajador</h2>
      <p>
        El trabajador firmante declara haber sido informado del sistema de registro
        horario implantado por la empresa y de sus derechos al respecto.
      </p>

      <table
        style={{
          width: "100%",
          marginTop: "12mm",
          borderCollapse: "collapse",
          fontSize: "10pt",
        }}
      >
        <tbody>
          <tr>
            <td style={{ width: "50%", padding: "4mm", verticalAlign: "top" }}>
              <p style={{ margin: 0 }}><strong>Por la empresa</strong></p>
              <p style={{ marginTop: "16mm" }}>
                Nombre: {company.legal_representative_name || "____________________"}<br />
                DNI: {company.legal_representative_id || "____________________"}<br />
                Firma:
              </p>
            </td>
            <td style={{ width: "50%", padding: "4mm", verticalAlign: "top" }}>
              <p style={{ margin: 0 }}><strong>El trabajador</strong></p>
              <p style={{ marginTop: "16mm" }}>
                Nombre: ____________________<br />
                DNI: ____________________<br />
                Firma:
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </DocumentLayout>
  );
};

export default RegistroHorarioInfo;
