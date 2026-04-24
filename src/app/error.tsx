'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  const isProfileError = error.message.includes('Store profile not found');

  return (
    <div className="flex-center" style={{ minHeight: '80vh', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4)', textAlign: 'center' }}>
      <div className="logo-icon" style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--color-danger)' }}>
        <AlertTriangle size={40} color="white" />
      </div>

      <div>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>
          {isProfileError ? 'Account Not Linked' : 'Something went wrong'}
        </h1>
        <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto' }}>
          {error.message || 'An unexpected error occurred. Please try again or contact support.'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button className="btn btn-primary" onClick={() => reset()}>
          <RefreshCcw size={18} /> Try Again
        </button>
        <Link href="/login" className="btn btn-outline">
          <Home size={18} /> Back to Login
        </Link>
      </div>

      {isProfileError && (
        <div className="glass-card" style={{ marginTop: 'var(--space-4)', maxWidth: '500px', border: '1px solid var(--color-primary)' }}>
          <p style={{ fontSize: '0.9rem' }}>
            <strong>Administrator Note:</strong> If you just cleared the database, you need to re-seed the initial store data or manually create a user profile record for this email.
          </p>
        </div>
      )}
    </div>
  );
}
