import { cn } from "@/lib/utils";
import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  color: string;
  changePercent?: number;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  changePercent,
}: StatCardProps) {
  const hasChange = changePercent !== undefined;
  const isPositive = (changePercent ?? 0) >= 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon size={18} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {hasChange && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium mb-1.5",
              isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(changePercent).toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
