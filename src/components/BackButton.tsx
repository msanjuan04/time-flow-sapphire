import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  to?: string | number;
  className?: string;
}

export const BackButton = ({ to = -1, className }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (typeof to === "number") {
      navigate(to);
    } else {
      navigate(to);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={cn("hover-scale", className)}
    >
      <ArrowLeft className="w-5 h-5" />
      <span className="sr-only">Volver</span>
    </Button>
  );
};
