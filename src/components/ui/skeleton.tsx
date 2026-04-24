import { cn } from "@/lib/utils";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = '8px', className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse bg-muted/20 border border-white/5", className)}
      style={{
        width,
        height,
        borderRadius,
      }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-card border border-border p-4 rounded-2xl flex flex-col gap-3 shadow-sm">
      <Skeleton width="40%" height="24px" />
      <Skeleton width="90%" height="16px" />
      <Skeleton width="70%" height="16px" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border/50">
      <Skeleton width="40px" height="40px" borderRadius="10px" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton width="60%" height="16px" />
        <Skeleton width="30%" height="12px" />
      </div>
      <Skeleton width="80px" height="20px" />
    </div>
  );
}
