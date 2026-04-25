import type { LegalDoc } from "./types";
import RegistroHorarioInfo from "./templates/RegistroHorarioInfo";
import ClausulaInformativaRgpd from "./templates/ClausulaInformativaRgpd";
import AcuerdoEncargadoTratamiento from "./templates/AcuerdoEncargadoTratamiento";
import PoliticaConservacion from "./templates/PoliticaConservacion";

export const LEGAL_DOCS: LegalDoc[] = [
  {
    id: "registro-horario-info",
    title: "Información al trabajador sobre el registro horario",
    description:
      "Comunicación oficial al trabajador del sistema de fichaje implantado, conforme al art. 34.9 ET y RD-Ley 8/2019. Incluye recibí firmado.",
    requiresCompanyLegal: true,
    Component: RegistroHorarioInfo,
  },
  {
    id: "clausula-informativa-rgpd",
    title: "Cláusula informativa RGPD para el trabajador",
    description:
      "Información obligatoria al trabajador sobre el tratamiento de sus datos personales (responsable, finalidades, derechos).",
    requiresCompanyLegal: true,
    Component: ClausulaInformativaRgpd,
  },
  {
    id: "acuerdo-encargado-tratamiento",
    title: "Contrato de encargado del tratamiento (DPA art. 28 RGPD)",
    description:
      "Acuerdo entre la empresa (responsable) y GNERAI (encargado) requerido por el RGPD para legitimar el tratamiento.",
    requiresCompanyLegal: true,
    Component: AcuerdoEncargadoTratamiento,
  },
  {
    id: "politica-conservacion",
    title: "Política interna de conservación de registros",
    description:
      "Documento interno que fija el plazo de 4 años de conservación obligatoria de los registros de jornada.",
    requiresCompanyLegal: false,
    Component: PoliticaConservacion,
  },
];

export const findLegalDoc = (id: string) => LEGAL_DOCS.find((d) => d.id === id);
