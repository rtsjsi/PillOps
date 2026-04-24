'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Pill, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

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
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#050505] flex items-center justify-center p-6 selection:bg-primary/20">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[440px] z-10">
        <div className="flex flex-col gap-10">
          
          {/* Header Section */}
          <div className="flex flex-col gap-6 animate-page-in">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white shadow-2xl shadow-primary/40 ring-4 ring-primary/10 rotate-[15deg] hover:rotate-0 transition-transform duration-500">
              <Pill size={32} />
            </div>
            
            <div className="space-y-1">
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                PillOps
              </h1>
              <p className="text-muted-foreground font-medium text-lg">
                Secure Staff Access
              </p>
            </div>
          </div>

          {/* Form Section */}
          <div className="space-y-8 animate-page-in [animation-delay:100ms]">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Welcome Back</h2>
                <p className="text-muted-foreground text-sm">Please enter your credentials to continue.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2 group">
                <Label htmlFor="email" className="text-sm font-semibold tracking-wide text-foreground/80 group-focus-within:text-primary transition-colors">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="email"
                    type="email"
                    placeholder="name@pharmacy.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-13 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base"
                  />
                </div>
              </div>

              <div className="space-y-2 group">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password" title="Password" className="text-sm font-semibold tracking-wide text-foreground/80 group-focus-within:text-primary transition-colors">
                        Password
                    </Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 h-13 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm font-medium text-destructive bg-destructive/10 p-4 rounded-xl border border-destructive/20 animate-in fade-in zoom-in-95 duration-300">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-13 text-lg font-bold rounded-xl shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] mt-4"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    Sign In <ArrowRight size={20} />
                  </div>
                )}
              </Button>
            </form>
          </div>

          {/* Footer Section */}
          <footer className="pt-4 border-t border-zinc-200 dark:border-zinc-800 animate-page-in [animation-delay:200ms]">
            <p className="text-center text-sm text-muted-foreground font-medium">
              Contact administrator for new account access
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
