import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle, Lightbulb, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface EmployeeInsight {
  employee_id: string;
  employee_name: string;
  strengths: string[];
  areas_for_improvement: string[];
  recommendations: string[];
  performance_trend: 'improving' | 'stable' | 'declining';
  recognition_suggestions?: string[];
  trend_percentage?: number;
}

interface EmployeeInsightsProps {
  employeeId: string;
  employeeName: string;
  companyId: string;
}

const EmployeeInsights = ({ employeeId, employeeName, companyId }: EmployeeInsightsProps) => {
  const [insights, setInsights] = useState<EmployeeInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await supabase.functions.invoke('employee-insights', {
          body: {
            employee_id: employeeId,
            company_id: companyId,
          },
        });

        if (response.error) throw response.error;
        setInsights(response.data);
      } catch (err) {
        console.error('Error fetching insights:', err);
        setError('No se pudieron cargar los insights del empleado');
      } finally {
        setLoading(false);
      }
    };

    if (employeeId && companyId) {
      fetchInsights();
    }
  }, [employeeId, companyId]);

  if (loading) {
    return (
      <Card className="glass-card p-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Analizando datos del empleado...</span>
        </div>
      </Card>
    );
  }

  if (error || !insights) {
    return (
      <Card className="glass-card p-6">
        <div className="text-center text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{error || 'No hay suficientes datos para generar insights'}</p>
        </div>
      </Card>
    );
  }

  const getTrendIcon = () => {
    switch (insights.performance_trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (insights.performance_trend) {
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getTrendText = () => {
    switch (insights.performance_trend) {
      case 'improving':
        return 'Mejorando';
      case 'declining':
        return 'Disminuyendo';
      default:
        return 'Estable';
    }
  };

  return (
    <Card className="glass-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Análisis: {insights.employee_name}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Recomendaciones personalizadas basadas en datos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getTrendIcon()}
          <span className={cn("text-sm font-medium", getTrendColor())}>
            {getTrendText()}
            {insights.trend_percentage && (
              <span className="ml-1">
                ({insights.trend_percentage >= 0 ? '+' : ''}{insights.trend_percentage.toFixed(1)}%)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Fortalezas */}
      {insights.strengths.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <h4 className="font-semibold">Fortalezas</h4>
          </div>
          <ul className="space-y-1.5 ml-7">
            {insights.strengths.map((strength, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Áreas de mejora */}
      {insights.areas_for_improvement.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <h4 className="font-semibold">Áreas de mejora</h4>
          </div>
          <ul className="space-y-1.5 ml-7">
            {insights.areas_for_improvement.map((area, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Recomendaciones */}
      {insights.recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            <h4 className="font-semibold">Recomendaciones</h4>
          </div>
          <ul className="space-y-1.5 ml-7">
            {insights.recommendations.map((rec, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Sugerencias de reconocimiento */}
      {insights.recognition_suggestions && insights.recognition_suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="pt-4 border-t"
        >
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-purple-500" />
            <h4 className="font-semibold">Sugerencias de reconocimiento</h4>
          </div>
          <div className="flex flex-wrap gap-2 ml-7">
            {insights.recognition_suggestions.map((suggestion, index) => (
              <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                {suggestion}
              </Badge>
            ))}
          </div>
        </motion.div>
      )}
    </Card>
  );
};

export default EmployeeInsights;

