import { Skeleton } from "@/components/ui/skeleton";

export default function GlobalLoading() {
  return (
    <div className="container py-8 flex flex-col gap-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-lg opacity-50" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-[400px] w-full rounded-2xl" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px] w-full rounded-2xl" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
      </div>
    </div>
  );
}
