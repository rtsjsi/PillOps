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
    <Card className={cn("border border-border bg-card shadow-none rounded-lg", className)}>
      <CardContent className="p-3 flex flex-col gap-0.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate flex items-center gap-1.5">
          {Icon && <Icon size={13} className={iconClassName ? iconClassName.replace(/bg-\S+/g, '').replace(/rounded-\S+/g, '').replace(/flex\b/g, '').replace(/items-center/g, '').replace(/justify-center/g, '').replace(/shrink-0/g, '').replace(/h-\d+/g, '').replace(/w-\d+/g, '').trim() : "text-primary"} />}
          {label}
        </p>
        <h3 className="text-base font-bold text-card-foreground tracking-tight">{value}</h3>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-[11px] font-bold",
            trend.isUp ? "text-primary" : "text-destructive"
          )}>
            <span>{trend.isUp ? '↑' : '↓'} {trend.value}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
