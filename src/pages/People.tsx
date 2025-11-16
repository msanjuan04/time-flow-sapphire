import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import Employees from "./Employees";

/**
 * Temporalmente reutilizamos la pantalla de empleados para el apartado de
 * "Gestión de personal" del owner. Así garantizamos que el módulo vuelve a
 * cargar mientras iteramos en una vista diferenciada.
 */
const People = () => {
  useDocumentTitle("Gestión de personal • GTiQ");
  return <Employees />;
};

export default People;
