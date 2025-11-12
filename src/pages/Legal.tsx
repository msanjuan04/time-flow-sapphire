import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { printHTML } from "@/lib/exports";
import { Button } from "@/components/ui/button";

const Legal = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-4xl mx-auto pt-10 animate-fade-in">
        <Card className="glass-card p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Información legal, privacidad y consentimientos</h1>
            <p className="text-muted-foreground mt-2">
              Plantillas base para cumplir con el RDL 8/2019, RGPD y LOPDGDD. Cada empresa usuaria de la plataforma es responsable del tratamiento y debe revisar/ajustar los datos identificativos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">Registro de jornada</Badge>
              <Badge variant="outline">RGPD/LOPDGDD</Badge>
              <Badge variant="outline">Consentimientos</Badge>
              <Badge variant="outline">Retención</Badge>
            </div>
            {/* Acciones principales visibles */}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => {
                  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Plantilla Legal</title></head><body>
                  <h1>Información legal y privacidad</h1>
                  <div>Plantilla para empresa responsable · ${new Date().toLocaleString('es-ES')}</div>
                  <h2>Aviso legal</h2>
                  <p>Responsable: [EMPRESA TITULAR], CIF/NIF [CIF], domicilio [DIRECCIÓN], email [EMAIL].</p>
                  <h2>Política de privacidad</h2>
                  <p>Finalidades: registro de jornada, gestión de incidencias, informes y opcionalmente geolocalización/foto.</p>
                  <p>Base jurídica: obligación legal, contrato, interés legítimo y, en su caso, consentimiento.</p>
                  <p>Conservación: al menos 4 años para registros de jornada.</p>
                  <h2>Política de cookies</h2>
                  <p>Cookies esenciales para sesión/preferencias. Sin publicidad salvo activación expresa de la empresa.</p>
                  <h2>Consentimientos</h2>
                  <p>Geolocalización/foto opcionales y revocables. Firma/acuse mensual disponible.</p>
                  <h2>Conservación y auditoría</h2>
                  <p>Revisiones y cambios quedan auditados (quién/cuándo/motivo).</p>
                  <h2>Derechos</h2>
                  <p>La persona trabajadora puede ejercer sus derechos ante la empresa responsable o la AEPD.</p>
                  </body></html>`;
                  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'plantilla-legal.html';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >Descargar plantilla</Button>
              <span className="text-sm text-muted-foreground">
                Tras rellenarla, envíala a {" "}
                <a className="underline" href="mailto:gnerai@gneraitiq.com">gnerai@gneraitiq.com</a>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <nav className="text-sm flex flex-wrap gap-3">
              <a href="#aviso-legal" className="underline hover:text-primary">Aviso legal</a>
              <a href="#privacidad" className="underline hover:text-primary">Política de privacidad</a>
              <a href="#cookies" className="underline hover:text-primary">Política de cookies</a>
              <a href="#consentimientos" className="underline hover:text-primary">Textos de consentimiento</a>
              <a href="#retencion" className="underline hover:text-primary">Conservación y auditoría</a>
              <a href="#derechos" className="underline hover:text-primary">Derechos de las personas</a>
            </nav>
            <div className="flex items-center gap-3">
              <button
                className="text-sm underline hover:text-primary"
                onClick={() => {
                  const body = `
                    <h1>Información legal y privacidad</h1>
                    <div class='muted'>Plantilla para empresa responsable · ${new Date().toLocaleString('es-ES')}</div>
                    <h2>Aviso legal</h2>
                    <p>Responsable: [EMPRESA TITULAR], CIF/NIF [CIF], domicilio [DIRECCIÓN], email [EMAIL].</p>
                    <h2>Política de privacidad</h2>
                    <p>Finalidades: registro de jornada, gestión de incidencias, informes y opcionalmente geolocalización/foto.</p>
                    <p>Base jurídica: obligación legal, contrato, interés legítimo y, en su caso, consentimiento.</p>
                    <p>Conservación: al menos 4 años para registros de jornada.</p>
                    <h2>Política de cookies</h2>
                    <p>Cookies esenciales para sesión/preferencias. Sin publicidad salvo activación expresa de la empresa.</p>
                    <h2>Consentimientos</h2>
                    <p>Geolocalización/foto opcionales y revocables. Firma/acuse mensual disponible.</p>
                    <h2>Conservación y auditoría</h2>
                    <p>Revisiones y cambios quedan auditados (quién/cuándo/motivo).</p>
                    <h2>Derechos</h2>
                    <p>La persona trabajadora puede ejercer sus derechos ante la empresa responsable o la AEPD.</p>
                  `;
                  printHTML('Legal · Plantilla', body);
                }}
              >Imprimir / Guardar como PDF</button>
              <button
                className="text-sm underline hover:text-primary"
                onClick={() => {
                  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Plantilla Legal</title></head><body>
                  <h1>Información legal y privacidad</h1>
                  <p>Responsable: [EMPRESA TITULAR], CIF/NIF [CIF], domicilio [DIRECCIÓN], email [EMAIL].</p>
                  <h2>Política de privacidad</h2>
                  <p>Finalidades: registro de jornada, incidencias, informes; geolocalización/foto opcionales.</p>
                  </body></html>`;
                  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'plantilla-legal.html';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >Descargar .HTML</button>
            </div>
          </div>

          <Separator />

          <section id="aviso-legal" className="space-y-3">
            <h2 className="text-xl font-semibold">Aviso legal</h2>
            <p className="text-muted-foreground">
              El responsable del tratamiento de los datos será, en cada caso, la empresa que contrata y utiliza la plataforma para gestionar el registro de jornada de su personal.
            </p>
            <div className="text-sm leading-relaxed">
              <p><strong>Responsable:</strong> [EMPRESA TITULAR], CIF/NIF [CIF], domicilio [DIRECCIÓN], email de contacto [EMAIL].</p>
              <p><strong>Finalidad de la web/app:</strong> gestión y cumplimiento de la obligación de registro de jornada, gestión de incidencias y elaboración de informes.</p>
            </div>
          </section>

          <Separator />

          <section id="privacidad" className="space-y-3">
            <h2 className="text-xl font-semibold">Política de privacidad</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p><strong>1) Finalidades</strong> — Registro de fichajes (entrada/salida/pausas), gestión de usuarios y roles, control de dispositivos, elaboración de informes, y, en su caso, geolocalización/fotografía con fines de verificación.</p>
              <p><strong>2) Base jurídica</strong> — Cumplimiento de una obligación legal (art. 6.1.c RGPD; RDL 8/2019), ejecución de contrato (6.1.b), interés legítimo (6.1.f) para seguridad e integridad, y consentimiento (6.1.a) para funcionalidades opcionales (p. ej., geolocalización/foto).</p>
              <p><strong>3) Datos tratados</strong> — Identificativos (nombre, email), laborales (rol/centro/equipo), fichajes (fechas/horas), dispositivos, y opcionalmente coordenadas GPS y fotografía en el momento del fichaje si la empresa lo habilita.</p>
              <p><strong>4) Destinatarios</strong> — Proveedores tecnológicos como encargados del tratamiento (alojamiento, email, analítica operativa) y administraciones/Inspección de Trabajo cuando proceda legalmente.</p>
              <p><strong>5) Transferencias internacionales</strong> — Si existieran, se amparan en cláusulas contractuales tipo y medidas complementarias. Consulte al administrador de su empresa por la lista de subencargados actualizada.</p>
              <p><strong>6) Plazos de conservación</strong> — Los registros de jornada se conservan al menos 4 años (o el plazo que resulte aplicable). Los logs de auditoría y revisiones se conservan como prueba de integridad durante el mismo periodo o el que la empresa determine.</p>
              <p><strong>7) Derechos</strong> — Puede ejercer acceso, rectificación, supresión, limitación, oposición y portabilidad ante su empresa (responsable del tratamiento). También puede reclamar ante la AEPD.</p>
              <p><strong>8) Contacto DPO/privacidad</strong> — [EMAIL DPO o CONTACTO PRIVACIDAD DE LA EMPRESA].</p>
            </div>
          </section>

          <Separator />

          <section id="cookies" className="space-y-3">
            <h2 className="text-xl font-semibold">Política de cookies</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>La aplicación utiliza exclusivamente cookies y/o almacenamiento local esenciales para mantener la sesión y preferencias (p. ej., tema). No se emplean cookies publicitarias ni de seguimiento comportamental, salvo que la empresa lo active expresamente y lo informe.</p>
              <p>Puede borrar o bloquear cookies desde la configuración de su navegador. El bloqueo de cookies esenciales puede impedir el inicio de sesión.</p>
            </div>
          </section>

          <Separator />

          <section id="consentimientos" className="space-y-3">
            <h2 className="text-xl font-semibold">Textos de consentimiento (plantillas)</h2>
            <div className="space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="font-medium">1) Geolocalización en fichajes (opcional)</h3>
                <p>
                  “Autorizo la captura de mi ubicación aproximada (coordenadas GPS) en el momento del fichaje,
                  con la única finalidad de verificación de presencia en el puesto de trabajo. Esta funcionalidad es
                  opcional y puede desactivarse por la empresa. La base jurídica es mi consentimiento, que puedo
                  retirar en cualquier momento sin efectos retroactivos.”
                </p>
              </div>
              <div>
                <h3 className="font-medium">2) Fotografía de verificación (opcional)</h3>
                <p>
                  “Autorizo la toma de una fotografía en el momento del fichaje para verificar mi identidad y evitar
                  usos indebidos. El tratamiento es opcional y basado en mi consentimiento, revocable en cualquier momento.”
                </p>
              </div>
              <div>
                <h3 className="font-medium">3) Firma/acuse mensual</h3>
                <p>
                  “Declaro haber revisado mi registro de jornada del mes [MES/AÑO] y lo considero conforme. En caso de disconformidad,
                  podré dejar constancia (‘disputa’) y solicitar rectificación. Se generará un acuse con fecha y huella del resumen.”
                </p>
              </div>
            </div>
          </section>

          <Separator />

          <section id="retencion" className="space-y-3">
            <h2 className="text-xl font-semibold">Conservación, inmutabilidad y auditoría</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>La plataforma conserva los registros de jornada y, en su caso, un historial de revisiones que documenta quién, cuándo y por qué se ha corregido un fichaje.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Conservación mínima orientativa: 4 años para registros de jornada.</li>
                <li>Revisiones/auditoría: cada cambio queda reflejado con persona, fecha, motivo y versión anterior.</li>
                <li>Paquetes mensuales: la empresa puede generar un resumen mensual con hash/identificador único.</li>
              </ul>
            </div>
          </section>

          <Separator />

          <section id="derechos" className="space-y-3">
            <h2 className="text-xl font-semibold">Derechos de las personas</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>Para ejercer sus derechos de protección de datos, contacte con el responsable (su empresa): acceso, rectificación, supresión, limitación, oposición y portabilidad. También puede reclamar ante la AEPD si considera que no se han atendido correctamente sus derechos.</p>
            </div>
          </section>

          <Separator />

          <section className="space-y-2 text-xs text-muted-foreground">
            <p>Estas plantillas son orientativas y deben ser adaptadas por cada empresa (responsable del tratamiento) a su realidad organizativa, proveedores y flujos de datos.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Plantilla Legal</title></head><body>
                  <h1>Información legal y privacidad</h1>
                  <div>Plantilla para empresa responsable · ${new Date().toLocaleString('es-ES')}</div>
                  <h2>Aviso legal</h2>
                  <p>Responsable: [EMPRESA TITULAR], CIF/NIF [CIF], domicilio [DIRECCIÓN], email [EMAIL].</p>
                  <h2>Política de privacidad</h2>
                  <p>Finalidades: registro de jornada, gestión de incidencias, informes y opcionalmente geolocalización/foto.</p>
                  <p>Base jurídica: obligación legal, contrato, interés legítimo y, en su caso, consentimiento.</p>
                  <p>Conservación: al menos 4 años para registros de jornada.</p>
                  <h2>Política de cookies</h2>
                  <p>Cookies esenciales para sesión/preferencias. Sin publicidad salvo activación expresa de la empresa.</p>
                  <h2>Consentimientos</h2>
                  <p>Geolocalización/foto opcionales y revocables. Firma/acuse mensual disponible.</p>
                  <h2>Conservación y auditoría</h2>
                  <p>Revisiones y cambios quedan auditados (quién/cuándo/motivo).</p>
                  <h2>Derechos</h2>
                  <p>La persona trabajadora puede ejercer sus derechos ante la empresa responsable o la AEPD.</p>
                  </body></html>`;
                  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'plantilla-legal.html';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >Descargar plantilla</Button>
              <span>
                Tras rellenarla, envíala a {" "}
                <a className="underline" href="mailto:gnerai@gneraitiq.com">gnerai@gneraitiq.com</a>. El SuperAdmin archivará el documento en tu ficha de empresa.
              </span>
            </div>
          </section>
        </Card>
      </div>
    </div>
  );
};

export default Legal;
