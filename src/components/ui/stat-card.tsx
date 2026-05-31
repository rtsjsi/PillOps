'use client';

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isUp: boolean;
  };
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
}

export function StatCard({ label, value, trend, icon: Icon, iconClassName, className }: StatCardProps) {
  return (
    <Card className={cn("border border-border bg-card shadow-none rounded-xl", className)}>
      <CardContent className="p-4 flex items-start gap-3">
        {Icon && (
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", iconClassName || "bg-primary/10 text-primary")}>
            <Icon size={20} />
          </div>
        )}
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <h3 className="text-lg font-bold text-card-foreground tracking-tight">{value}</h3>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-[11px] font-bold",
              trend.isUp ? "text-primary" : "text-destructive"
            )}>
              <span>{trend.isUp ? '↑' : '↓'} {trend.value}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
