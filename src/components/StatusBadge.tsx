import { cn } from "@/lib/utils";
import { CheckCircle, Wrench, AlertTriangle } from "lucide-react";

interface StatusBadgeProps {
  status: "ok" | "cleaning" | "replacement";
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({ status, showIcon = true, size = "md" }: StatusBadgeProps) {
  const config = {
    ok: {
      label: "OK",
      className: "bg-success/15 text-success border-success/30",
      icon: CheckCircle,
    },
    cleaning: {
      label: "Limpeza",
      className: "bg-warning/15 text-warning border-warning/30",
      icon: Wrench,
    },
    replacement: {
      label: "Substituir",
      className: "bg-destructive/15 text-destructive border-destructive/30",
      icon: AlertTriangle,
    },
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
    >
      {showIcon && <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />}
      {label}
    </span>
  );
}
