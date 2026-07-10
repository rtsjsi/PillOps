import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function StatCardSkeleton() {
  return <Skeleton className="h-[88px] w-full rounded-xl" />;
}

function ListCardSkeleton({ title }: { title: string }) {
  return (
    <Card className="border-border shadow-sm bg-card flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
        <CardTitle className="text-lg font-bold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col divide-y divide-border/50">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-lg opacity-60" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">
        <ListCardSkeleton title="Recent Purchases" />
        <ListCardSkeleton title="Recent Sales" />
      </div>
    </div>
  );
}
