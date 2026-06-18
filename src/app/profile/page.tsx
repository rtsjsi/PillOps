'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Shield, Key, Loader2, Edit2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from '@/utils/supabase/client';
import { fetchUserProfile } from '@/lib/queries';
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
      const data = await fetchUserProfile();
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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      
      const { error } = await supabase.from('user_profiles').update({ full_name: newName }).eq('id', user.id);
      if (error) throw error;
      
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
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
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
    <div className="container py-8 max-w-2xl flex flex-col gap-8 pb-24">
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
          <Avatar className="h-24 w-24 border-2 border-slate-100">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-4 w-full">
            {!isEditingName ? (
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Full Name</p>
                  <h2 className="text-xl font-bold">{profile.full_name || 'No Name Set'}</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsEditingName(true)}>
                  <Edit2 size={16} className="mr-2" /> Edit
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Full Name</p>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} className="h-9" />
                </div>
                <div className="flex gap-1 mt-5">
                  <Button size="sm" onClick={handleUpdateName} disabled={savingName}>
                    {savingName ? <Loader2 className="animate-spin" size={16} /> : 'Save'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingName(false)}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><Mail size={12} /> Email</p>
                <p className="font-medium text-sm">{profile.user.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><Shield size={12} /> Role</p>
                <p className="font-medium text-sm capitalize">{profile.role.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-lg flex items-center gap-2">
            <Key size={18} /> Update Password
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {!isEditingPass ? (
            <Button variant="outline" onClick={() => setIsEditingPass(true)}>
              Change Password
            </Button>
          ) : (
            <div className="flex items-center gap-3 max-w-sm">
              <Input 
                type="password" 
                placeholder="New Password (min 6 chars)" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
              />
              <Button onClick={handleUpdatePassword} disabled={savingPass}>
                {savingPass ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
              </Button>
              <Button variant="ghost" onClick={() => setIsEditingPass(false)}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
