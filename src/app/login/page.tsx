'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { clearUserProfileCache } from '@/lib/queries';
import { useRouter } from 'next/navigation';
import { Pill, Lock, Mail, Loader2, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      document.cookie = 'pillops_selected_store_id=; path=/; max-age=0';
      clearUserProfileCache();
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/20 selection:bg-primary/20 p-4">
      <div className="w-full max-w-[420px] animate-page-in">
        
        {/* Branding */}
        <div className="flex flex-col items-center justify-center mb-8 gap-3">
          <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/20">
            <Pill size={32} className="rotate-[135deg]" />
          </div>
          <span className="text-3xl font-extrabold tracking-tighter text-foreground">PillOps</span>
        </div>
          <div className="bg-card p-10 rounded-[2.5rem] shadow-2xl shadow-black/5 border border-border">
            <div className="mb-10 space-y-2">
                <h2 className="text-3xl font-extrabold tracking-tight text-card-foreground">Welcome Back</h2>
                <p className="text-muted-foreground font-medium">Secure access to your store dashboard.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2 group">
                <Label htmlFor="email" className="text-sm font-bold text-card-foreground group-focus-within:text-primary transition-colors">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="email"
                    type="email"
                    autoFocus
                   
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-14 bg-muted/50 border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2 group">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password" title="Password" className="text-sm font-bold text-card-foreground group-focus-within:text-primary transition-colors">
                        Password
                    </Label>
                    <button type="button" className="text-xs font-bold text-primary hover:underline">
                        Forgot password?
                    </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="password"
                    type={showPassword ? "text" : "password"}
                   
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 h-14 bg-muted/50 border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm font-bold text-destructive bg-destructive/10 p-4 rounded-2xl border border-destructive/20 animate-in fade-in zoom-in-95 duration-300 text-center">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] mt-4"
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

            <div className="mt-8 pt-8 border-t border-border text-center">
              <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                New branch registration? <br />
                <span className="text-foreground font-bold underline cursor-pointer hover:text-primary">Contact administrator</span>
              </p>
            </div>
        </div>
      </div>
    </div>
  );
}
