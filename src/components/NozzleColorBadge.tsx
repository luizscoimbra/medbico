import { cn } from "@/lib/utils";
import { NozzleType } from "@/lib/nozzleData";

interface NozzleColorBadgeProps {
  nozzle: NozzleType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function NozzleColorBadge({ nozzle, size = "md", showLabel = true }: NozzleColorBadgeProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "rounded-full shadow-sm flex-shrink-0",
          sizeClasses[size],
          nozzle.tailwindClass
        )}
        style={{ backgroundColor: nozzle.hexColor }}
        title={nozzle.colorNamePt}
      />
      {showLabel && (
        <span className="text-sm font-medium text-foreground">
          {nozzle.colorNamePt}
        </span>
      )}
    </div>
  );
}
