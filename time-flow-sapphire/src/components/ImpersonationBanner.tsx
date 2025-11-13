import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useEffect } from "react";

export const ImpersonationBanner = () => {
  const { isImpersonating, impersonationData, stopImpersonation, loading } = useImpersonation();

  // Add padding to body when banner is visible
  useEffect(() => {
    if (isImpersonating) {
      document.body.style.paddingTop = "52px";
    } else {
      document.body.style.paddingTop = "0";
    }

    return () => {
      document.body.style.paddingTop = "0";
    };
  }, [isImpersonating]);

  if (!isImpersonating || !impersonationData) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm font-medium">
              <span className="font-bold">MODO IMPERSONACIÓN:</span>{" "}
              Viendo como{" "}
              <span className="font-bold">{impersonationData.company_name}</span>
              {impersonationData.as_role && (
                <span className="ml-2">
                  (rol: <span className="font-bold uppercase">{impersonationData.as_role}</span>)
                </span>
              )}
            </div>
          </div>
          <Button
            onClick={stopImpersonation}
            disabled={loading}
            size="sm"
            variant="secondary"
            className="flex-shrink-0 bg-white text-amber-600 hover:bg-gray-100"
          >
            <X className="w-4 h-4 mr-1" />
            Salir
          </Button>
        </div>
      </div>
    </div>
  );
};
