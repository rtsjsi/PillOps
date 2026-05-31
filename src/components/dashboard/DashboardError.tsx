'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardErrorProps {
  isProfileError: boolean;
}

export default function DashboardError({ isProfileError }: DashboardErrorProps) {
  return (
    <div className="container flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center">
      <div className={cn(
        "w-20 h-20 rounded-3xl flex items-center justify-center",
        isProfileError ? "bg-primary" : "bg-destructive"
      )}>
        <AlertTriangle size={40} className="text-white" />
      </div>
      
      <div>
        <h1 className="text-2xl font-bold mb-2 tracking-tight text-foreground">
          {isProfileError ? 'Account Verification Pending' : 'Something went wrong'}
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
          {isProfileError 
            ? 'Your account is authenticated, but it hasn\'t been linked to a pharmacy store profile yet. Please reach out to your organization administrator to complete your setup.' 
            : 'An unexpected error occurred while loading your dashboard. Please try again later.'}
        </p>
      </div>

      <div className="flex gap-4 mt-2">
        <Link href="/login">
          <Button className="px-8 h-12 rounded-xl font-bold shadow-md">
            Return to Login
          </Button>
        </Link>
        <Button 
          variant="outline" 
          className="px-8 h-12 rounded-xl font-bold"
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </Button>
      </div>
    </div>
  );
}
