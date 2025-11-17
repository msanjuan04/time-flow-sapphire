import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

interface PrintPayload {
  title: string;
  body: string;
}

const PrintView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<PrintPayload | null>(null);

  useEffect(() => {
    if (!id) return;
    const raw = sessionStorage.getItem(`print:${id}`);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PrintPayload;
      setPayload(parsed);
      sessionStorage.removeItem(`print:${id}`);
    } catch {
      sessionStorage.removeItem(`print:${id}`);
    }
  }, [id]);

  useEffect(() => {
    if (payload) {
      const timer = setTimeout(() => {
        window.print();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [payload]);

  if (!payload) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white text-slate-900">
        <p>No se encontró el contenido para imprimir.</p>
        <button
          className="px-4 py-2 rounded bg-primary text-primary-foreground"
          onClick={() => navigate(-1)}
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto p-6 print:p-0 print:m-0">
        <header className="mb-6 print:mb-4">
          <h1 className="text-2xl font-semibold">{payload.title}</h1>
          <p className="text-sm text-muted-foreground hidden print:block">
            Documento generado desde GTiQ
          </p>
          <p className="text-xs text-muted-foreground hidden print:block">
            Conserva este documento durante al menos 4 años según RDL 8/2019.
          </p>
          <p className="text-sm text-muted-foreground print:hidden">
            La ventana de impresión debería abrirse automáticamente. Si no ocurre, usa
            Ctrl/Cmd + P.
          </p>
        </header>
        <section
          className="text-sm leading-relaxed print:text-xs"
          dangerouslySetInnerHTML={{ __html: payload.body }}
        />
        <footer className="mt-6 text-xs text-muted-foreground print:mt-4">
          Este documento incluye datos de registro horario. Las correcciones deben mantenerse auditadas.
        </footer>
      </div>
    </div>
  );
};

export default PrintView;
