'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Shield, Key, Loader2, Edit2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUserProfile, updateProfile, updatePassword } from '../actions';
import { toast } from "sonner";
import GlobalLoading from '../loading';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [isEditingPass, setIsEditingPass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await getUserProfile();
      setProfile(data);
      setNewName(data?.full_name || '');
    } catch (e: any) {
      toast.error(e.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateName = async () => {
    setSavingName(true);
    try {
      await updateProfile(newName);
      toast.success("Profile updated");
      setIsEditingName(false);
      await loadProfile();
    } catch (e: any) {
      toast.error(e.message || "Failed to update profile");
    } finally {
      setSavingName(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSavingPass(true);
    try {
      await updatePassword(newPassword);
      toast.success("Password updated successfully");
      setIsEditingPass(false);
      setNewPassword('');
    } catch (e: any) {
      toast.error(e.message || "Failed to update password");
    } finally {
      setSavingPass(false);
    }
  };

  if (loading) return <GlobalLoading />;
  if (!profile) return <div>Failed to load profile.</div>;

  const initials = (profile.full_name || profile.user.email || 'U').substring(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-8 animate-page-in pb-24 relative overflow-hidden min-h-[calc(100vh-2rem)]">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[50%] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <header className="relative z-10">
        <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-zinc-900 to-zinc-500">
          Account Profile
        </h1>
        <p className="text-muted-foreground font-medium mt-1">Manage your personal credentials and identity.</p>
      </header>

      <div className="max-w-3xl flex flex-col gap-8 relative z-10">
        
        {/* Profile Card */}
        <Card className="border border-white/40 shadow-2xl shadow-primary/5 bg-white/70 backdrop-blur-xl overflow-hidden rounded-[2rem] transition-all hover:shadow-primary/10">
          <div className="h-40 w-full bg-gradient-to-r from-primary via-[#145d48] to-[#0c3e2f] relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
             <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
          </div>
          <CardContent className="p-8 pt-0 flex flex-col items-center gap-6 relative">
             <div className="relative -mt-20 group">
               <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
               <Avatar className="h-36 w-36 border-4 border-white shadow-2xl bg-white relative transition-transform duration-500 group-hover:scale-105">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-[#0f4c3a] text-white text-5xl font-extrabold shadow-inner">
                    {initials}
                  </AvatarFallback>
               </Avatar>
             </div>
             
             <div className="text-center w-full space-y-2">
                {!isEditingName ? (
                  <div className="flex items-center justify-center gap-3">
                    <h2 className="text-3xl font-black tracking-tight text-zinc-800">{profile.full_name || 'No Name Set'}</h2>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-zinc-100 text-zinc-400 hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => setIsEditingName(true)}>
                      <Edit2 size={16} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 max-w-sm mx-auto bg-white/80 p-2 rounded-2xl shadow-sm border border-zinc-100 backdrop-blur-md">
                    <Input value={newName} onChange={e => setNewName(e.target.value)} className="h-11 font-bold text-center border-none focus-visible:ring-0 bg-transparent text-lg" placeholder="Your Full Name" />
                    <Button size="icon" onClick={handleUpdateName} disabled={savingName} className="rounded-xl shadow-md">
                      {savingName ? <Loader2 className="animate-spin" size={16} /> : <Edit2 size={16} />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setIsEditingName(false)} className="rounded-xl">
                      X
                    </Button>
                  </div>
                )}
                
                <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <p className="text-xs font-black uppercase tracking-widest">
                    {profile.role.replace('_', ' ')}
                  </p>
                </div>
             </div>

             <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 pt-8 mt-2 border-t border-slate-200/50">
                <div className="flex items-center gap-4 p-5 bg-white/60 rounded-3xl border border-white shadow-sm hover:shadow-md transition-shadow group">
                   <div className="p-3 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
                     <Mail size={22} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Email Address</p>
                      <p className="text-sm font-bold text-zinc-700">{profile.user.email}</p>
                   </div>
                </div>
                <div className="flex items-center gap-4 p-5 bg-white/60 rounded-3xl border border-white shadow-sm hover:shadow-md transition-shadow group">
                   <div className="p-3 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
                     <Shield size={22} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Account Privileges</p>
                      <p className="text-sm font-bold text-zinc-700 capitalize">{profile.role.replace('_', ' ')}</p>
                   </div>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Security Settings Card */}
        <Card className="border border-white/40 shadow-xl shadow-zinc-900/5 bg-white/70 backdrop-blur-xl overflow-hidden rounded-[2rem] transition-all">
          <CardHeader className="border-b border-zinc-200/50 bg-white/40 px-8 py-6">
            <CardTitle className="text-xl font-bold flex items-center gap-3 text-zinc-800">
              <div className="p-2 bg-primary/10 rounded-xl text-primary"><Key size={20} /></div> 
              Security & Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {!isEditingPass ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-base text-zinc-800">Account Password</h4>
                  <p className="text-sm text-zinc-500 mt-1">Ensure your account is using a long, random password to stay secure.</p>
                </div>
                <Button className="font-bold rounded-xl h-11 px-6 shadow-lg shadow-primary/20 hover:scale-105 transition-transform" onClick={() => setIsEditingPass(true)}>
                  Update Password
                </Button>
              </div>
            ) : (
              <div className="space-y-6 max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500 ml-1">New Secure Password</Label>
                  <Input 
                    type="password" 
                    placeholder="Enter at least 6 characters..." 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    className="h-14 rounded-2xl bg-white border-zinc-200 shadow-inner px-5 font-medium focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleUpdatePassword} disabled={savingPass} className="h-12 px-6 rounded-xl font-bold shadow-lg shadow-primary/20">
                    {savingPass ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                    Save New Password
                  </Button>
                  <Button variant="ghost" onClick={() => setIsEditingPass(false)} className="h-12 px-6 rounded-xl font-bold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
