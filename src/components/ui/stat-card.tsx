'use client';

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isUp: boolean;
  };
  description?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, description, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden border-none shadow-sm bg-white dark:bg-zinc-900", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2.5 bg-primary/5 rounded-xl text-primary ring-1 ring-primary/10 transition-all group-hover:scale-110">
            <Icon size={22} />
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-full",
              trend.isUp ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
            )}>
              {trend.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trend.value}%
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
          <h3 className="text-3xl font-extrabold tracking-tight">{value}</h3>
          {description && (
            <p className="text-[10px] text-muted-foreground font-medium pt-1">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
