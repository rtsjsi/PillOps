'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Pill, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <div className="min-h-screen bg-white text-black p-8 md:p-24 flex flex-col items-start font-sans">
      <div className="w-full max-w-[400px] flex flex-col gap-6">
        
        {/* Brand Icon */}
        <div className="mb-2">
            <Pill size={48} className="rotate-[135deg] text-black stroke-[2.5]" />
        </div>

        {/* Brand Name */}
        <div className="mb-4">
            <h1 className="text-5xl font-bold tracking-tight mb-2" style={{ fontFamily: 'serif' }}>PillOps</h1>
            <p className="text-xl" style={{ fontFamily: 'serif' }}>Secure Staff Access</p>
        </div>

        {/* Welcome Text */}
        <div className="mb-2">
            <p className="text-xl" style={{ fontFamily: 'serif' }}>Welcome Back</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-6 w-full">
            <div className="grid gap-2">
                <Label htmlFor="email" className="text-lg" style={{ fontFamily: 'serif' }}>Email Address</Label>
                <div className="flex items-center gap-3">
                    <Mail size={32} className="shrink-0" />
                    <Input 
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-10 bg-[#eef4ff] border-gray-400 rounded-sm focus-visible:ring-0 text-lg"
                    />
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="password" title="Password" className="text-lg" style={{ fontFamily: 'serif' }}>Password</Label>
                <div className="flex items-center gap-3">
                    <Lock size={32} className="shrink-0" />
                    <Input 
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-10 bg-[#eef4ff] border-gray-400 rounded-sm focus-visible:ring-0 text-lg"
                    />
                </div>
            </div>

            {error && (
                <p className="text-red-600 text-sm italic">{error}</p>
            )}

            <div className="mt-2">
                <Button 
                    type="submit" 
                    variant="outline"
                    className="h-12 px-6 rounded-md border-gray-400 bg-[#eeeeee] hover:bg-gray-200 text-black text-xl flex items-center gap-2"
                    disabled={loading}
                    style={{ fontFamily: 'serif' }}
                >
                    {loading ? (
                        <Loader2 className="animate-spin" size={24} />
                    ) : (
                        <>
                            Sign In <ArrowRight size={24} />
                        </>
                    )}
                </Button>
            </div>
        </form>

        {/* Footer */}
        <p className="mt-4 text-xl" style={{ fontFamily: 'serif' }}>
            Contact administrator for new account access
        </p>
      </div>
    </div>
  );
}
