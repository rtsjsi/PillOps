'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface DashboardErrorProps {
  isProfileError: boolean;
}

export default function DashboardError({ isProfileError }: DashboardErrorProps) {
  return (
    <div className="container flex-center" style={{ minHeight: '70vh', flexDirection: 'column', gap: 'var(--space-5)', textAlign: 'center' }}>
      <div className="logo-icon" style={{ width: '80px', height: '80px', borderRadius: '24px', background: isProfileError ? 'var(--color-primary)' : 'var(--color-danger)' }}>
        <AlertTriangle size={40} color="white" />
      </div>
      
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)', letterSpacing: '-0.5px' }}>
          {isProfileError ? 'Account Verification Pending' : 'Something went wrong'}
        </h1>
        <p className="text-muted" style={{ maxWidth: '450px', lineHeight: '1.6' }}>
          {isProfileError 
            ? 'Your account is authenticated, but it hasn\'t been linked to a pharmacy store profile yet. Please reach out to your organization administrator to complete your setup.' 
            : 'An unexpected error occurred while loading your dashboard. Please try again later.'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Link href="/login" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
          Return to Login
        </Link>
        <button 
          className="btn btn-outline" 
          style={{ padding: '0.75rem 2rem' }} 
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

