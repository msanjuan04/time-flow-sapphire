import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ✅ Iconos (una sola línea, sin duplicados ni ArrowLeft)
import {
  UserPlus,
  Search,
  Edit,
  Mail,
  XCircle,
  RefreshCw,
  Power,
  Crown,
  Download,
  FileText,
  Users as UsersIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useSuperadmin } from "@/hooks/useSuperadmin";
import { toast } from "sonner";
import InviteUserDialog from "@/components/InviteUserDialog";
import EditUserDialog from "@/components/EditUserDialog";
import { motion } from "framer-motion";

// ✅ Resto de imports necesarios
import { BackButton } from "@/components/BackButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { exportCSV, printHTML } from "@/lib/exports";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// --- al final de src/pages/People.tsx ---
const People: React.FC = () => {
  useDocumentTitle("Personas • GTiQ");
  // deja el contenido que ya tenías; esto es un stub seguro para compilar
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8">
        <div className="flex items-center gap-3">
          <BackButton to="/" />
          <h1 className="text-2xl font-bold">Gestión de Personas</h1>
        </div>
        {/* aquí va tu UI real (tabs, tablas, etc.) */}
      </div>
    </div>
  );
};

export default People;