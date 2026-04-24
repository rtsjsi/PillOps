'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Pill, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', background: 'var(--color-bg-primary)', padding: 'var(--space-4)' }}>
      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        {/* Brand */}
        <div className="flex-center" style={{ flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div 
              className="flex-center" 
              style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '20px', 
                background: 'var(--color-primary)',
                color: 'white',
                boxShadow: 'var(--shadow-lg), 0 0 30px var(--color-primary-glow)'
              }}
            >
              <Pill size={36} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>PillOps</h1>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>Secure Pharmacist Access</p>
            </div>
        </div>

        <Card style={{ padding: 'var(--space-5)', borderRadius: '24px' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.5 }} />
                <input 
                  type="email"
                  className="input"
                  placeholder="name@pharmacy.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.5 }} />
                <input 
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                />
              </div>
            </div>

            {error && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-danger)', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ 
                marginTop: 'var(--space-2)', 
                padding: '14px', 
                fontSize: '1rem', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Sign In <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </Card>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Contact administrator for new account access
        </div>
      </div>
    </div>
  );
}
