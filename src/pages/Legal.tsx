import { Card } from "@/components/ui/card";

const Legal = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-3xl mx-auto pt-10 animate-fade-in">
        <Card className="glass-card p-6 space-y-4">
          <h1 className="text-2xl font-bold">Información legal y privacidad</h1>
          <p className="text-muted-foreground">
            Esta aplicación registra las horas de inicio y fin de la jornada, así como las pausas, de
            conformidad con el RDL 8/2019 (España) y la Directiva 2003/88/CE. Los datos se conservan
            durante el periodo legal mínimo y están disponibles para el trabajador, la empresa y la Inspección de Trabajo.
          </p>
          <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
            <li>Correcciones auditadas: toda modificación queda registrada con persona, fecha y motivo.</li>
            <li>Geolocalización/foto opcionales y configurables por la empresa, con información y consentimiento previo.</li>
            <li>Derechos de acceso, rectificación y portabilidad disponibles para cada trabajador.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Para más detalles, contacta con el administrador o responsable de protección de datos de tu empresa.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Legal;

