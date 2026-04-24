'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
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
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white selection:bg-teal-500/20">
      
      {/* Left Panel - Deep Teal */}
      <div className="md:w-1/2 bg-[#0f4c3a] p-8 md:p-16 flex flex-col justify-between text-white overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-teal-400/10 rounded-full blur-[100px]" />
        
        <div className="z-10 animate-page-in">
          <div className="flex items-center gap-3 mb-12">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
              <Pill size={32} className="rotate-[135deg]" />
            </div>
            <span className="text-3xl font-extrabold tracking-tighter">PillOps</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight">
              Smart Pharmacy <br /> Operations.
            </h1>
            <p className="text-teal-100/70 text-lg max-w-md">
              The next-generation platform for pharmaceutical inventory, sales, and automated compliance.
            </p>

            <ul className="space-y-4 pt-8">
               {[
                 'Automated AI Invoice Scanning',
                 'Real-time Stock Urgency Alerts',
                 'Comprehensive Multi-branch Reporting'
               ].map((feature, i) => (
                 <li key={i} className="flex items-center gap-3 text-teal-50 font-medium">
                   <CheckCircle2 size={20} className="text-teal-400" />
                   {feature}
                 </li>
               ))}
            </ul>
          </div>
        </div>

        <div className="z-10 pt-12 animate-page-in [animation-delay:200ms]">
          <p className="text-teal-400/60 text-sm font-bold uppercase tracking-widest">Trusted by 500+ Pharmacies</p>
        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="md:w-1/2 flex items-center justify-center p-8 bg-zinc-50/50">
        <div className="w-full max-w-[420px] animate-page-in [animation-delay:150ms]">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-teal-900/5 border border-zinc-100">
            <div className="mb-10 space-y-2">
                <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">Welcome Back</h2>
                <p className="text-zinc-500 font-medium">Secure access to your store dashboard.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2 group">
                <Label htmlFor="email" className="text-sm font-bold text-zinc-700 group-focus-within:text-[#0f4c3a] transition-colors">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-[#0f4c3a] transition-colors" />
                  <Input 
                    id="email"
                    type="email"
                    placeholder="pharmacist@store.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-14 bg-zinc-50 border-zinc-200 rounded-2xl focus:ring-4 focus:ring-teal-500/10 focus:border-[#0f4c3a] transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2 group">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password" title="Password" className="text-sm font-bold text-zinc-700 group-focus-within:text-[#0f4c3a] transition-colors">
                        Password
                    </Label>
                    <button type="button" className="text-xs font-bold text-[#0f4c3a] hover:underline">
                        Forgot password?
                    </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-[#0f4c3a] transition-colors" />
                  <Input 
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 h-14 bg-zinc-50 border-zinc-200 rounded-2xl focus:ring-4 focus:ring-teal-500/10 focus:border-[#0f4c3a] transition-all font-medium"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm font-bold text-red-600 bg-red-50 p-4 rounded-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-300 text-center">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-bold rounded-2xl bg-[#0f4c3a] hover:bg-[#0c3e2f] shadow-xl shadow-teal-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] mt-4"
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

            <div className="mt-8 pt-8 border-t border-zinc-100 text-center">
              <p className="text-sm text-zinc-400 font-medium leading-relaxed">
                New branch registration? <br />
                <span className="text-zinc-600 font-bold underline cursor-pointer">Contact administrator</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
