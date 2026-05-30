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
    <div className="flex flex-col gap-8 animate-page-in pb-24">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Account Profile</h1>
        <p className="text-muted-foreground font-medium">Manage your personal credentials and identity.</p>
      </header>

      <div className="max-w-2xl flex flex-col gap-6">
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-32 bg-primary/10 w-full relative" />
          <CardContent className="p-8 -mt-16 flex flex-col items-center gap-6 relative">
             <Avatar className="h-32 w-32 border-4 border-white shadow-xl bg-white">
                <AvatarFallback className="bg-primary text-white text-4xl font-extrabold">{initials}</AvatarFallback>
             </Avatar>
             
             <div className="text-center w-full">
                {!isEditingName ? (
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-2xl font-black tracking-tight">{profile.full_name || 'No Name Set'}</h2>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => setIsEditingName(true)}>
                      <Edit2 size={14} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
                    <Input value={newName} onChange={e => setNewName(e.target.value)} className="h-9 font-bold text-center" />
                    <Button size="sm" onClick={handleUpdateName} disabled={savingName}>
                      {savingName ? <Loader2 className="animate-spin" size={14} /> : 'Save'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingName(false)}>Cancel</Button>
                  </div>
                )}
                
                <p className="text-xs font-black uppercase tracking-widest text-primary/60 mt-1">
                  {profile.role.replace('_', ' ')}
                </p>
             </div>

             <div className="w-full grid grid-cols-1 gap-4 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                   <Mail className="text-primary/40" size={20} />
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address (Login ID)</p>
                      <p className="text-sm font-bold">{profile.user.email}</p>
                   </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                   <Shield className="text-primary/40" size={20} />
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account Role</p>
                      <p className="text-sm font-bold capitalize">{profile.role.replace('_', ' ')}</p>
                   </div>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Key size={18} className="text-primary" /> Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {!isEditingPass ? (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">Account Password</h4>
                  <p className="text-xs text-muted-foreground mt-1">Update your password to keep your account secure.</p>
                </div>
                <Button variant="outline" className="font-bold shadow-sm" onClick={() => setIsEditingPass(true)}>
                  Change Password
                </Button>
              </div>
            ) : (
              <div className="space-y-4 max-w-sm">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">New Password</Label>
                  <Input type="password" placeholder="Min 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleUpdatePassword} disabled={savingPass} className="font-bold shadow-md shadow-primary/20">
                    {savingPass ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                    Save Password
                  </Button>
                  <Button variant="ghost" onClick={() => setIsEditingPass(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
