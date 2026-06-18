'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowDownToLine, Receipt, Package, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function ReportsDashboard() {
  const reports = [
    {
      title: 'Sales Register',
      description: 'View all historical point of sale transactions and generate invoices.',
      icon: Receipt,
      href: '/reports/sales',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Purchase Register',
      description: 'Track all your inward stock, distributor bills, and purchase history.',
      icon: ArrowDownToLine,
      href: '/reports/purchases',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'On Hand Stock',
      description: 'Live snapshot of your current inventory across all batches.',
      icon: Package,
      href: '/reports/inventory',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="container py-8 flex flex-col gap-8 pb-24">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card className="hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer h-full border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl ${report.bgColor} flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${report.color}`} />
                  </div>
                  <CardTitle className="text-xl">{report.title}</CardTitle>
                  <CardDescription className="text-sm font-medium mt-2 leading-relaxed">
                    {report.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
