'use client';

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isUp: boolean;
  };
  className?: string;
}

export function StatCard({ label, value, trend, description, className }: StatCardProps) {
  return (
    <Card className={cn("border border-zinc-100 bg-white shadow-none rounded-xl", className)}>
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-[#7c7e8c]">{label}</p>
        </div>
        
        <div className="flex flex-col">
          <h3 className="text-sm font-bold text-[#44475b]">{value}</h3>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-[11px] font-medium",
              trend.isUp ? "text-primary" : "text-destructive"
            )}>
              <span>{trend.isUp ? '+' : '-'}{trend.value}</span>
              <span>({trend.value}%)</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
