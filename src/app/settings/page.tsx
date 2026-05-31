'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Bell, Store, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchStoreSettings, fetchUserProfile } from '@/lib/queries';
import { createClient } from '@/utils/supabase/client';
import { toast } from "sonner";
import GlobalLoading from '../loading';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState('staff');
  const [storeData, setStoreData] = useState({
    name: '',
    address: '',
    phone: '',
    gstin: ''
  });

  const [alertsEnabled, setAlertsEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await fetchStoreSettings();
      if (data) {
        setStoreData({
          name: data.name || '',
          address: data.address || '',
          phone: data.phone || '',
          gstin: data.gstin || ''
        });
      }
      
      const profile = await fetchUserProfile();
      setRole(profile?.role || 'staff');
    } catch (e: any) {
      toast.error(e.message || "Failed to load store settings");
    } finally {
      setLoading(false);
    }
  }

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'owner' && role !== 'super_admin') {
      toast.error('Only owners can update store settings');
      return;
    }
    setSaving(true);
    try {
      const profile = await fetchUserProfile();
      if (!profile?.store_id) throw new Error("No store assigned");
      const supabase = createClient();
      const { error } = await supabase.from('stores').update(storeData).eq('id', profile.store_id);
      if (error) throw new Error(error.message);
      toast.success("Store settings updated successfully");
      await loadSettings();
    } catch (e: any) {
      toast.error(e.message || "Failed to update store settings");
    } finally {
      setSaving(false);
    }
  };

  const isEditable = role === 'owner' || role === 'super_admin';

  if (loading) return <GlobalLoading />;

  return (
    <div className="flex flex-col gap-8 animate-page-in pb-24">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground font-medium">Configure your pharmacy preferences and security.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-primary/5 text-primary rounded-lg"><Store size={20} /></div>
            <CardTitle className="text-lg font-bold">Store Profile</CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-sm text-muted-foreground italic mb-6">Manage pharmacy contact details, GSTIN, and physical address.</p>
             <form onSubmit={handleSaveStore} className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Pharmacy Name</Label>
                  <Input autoFocus required disabled={!isEditable} value={storeData.name} onChange={e => setStoreData({...storeData, name: e.target.value})} className="h-10 bg-slate-50" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Number</Label>
                  <Input disabled={!isEditable} value={storeData.phone} onChange={e => setStoreData({...storeData, phone: e.target.value})} className="h-10 bg-slate-50" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">GSTIN Number</Label>
                  <Input disabled={!isEditable} value={storeData.gstin} onChange={e => setStoreData({...storeData, gstin: e.target.value})} className="h-10 bg-slate-50 uppercase" pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$" title="Valid 15-character GSTIN required" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Physical Address</Label>
                  <Textarea disabled={!isEditable} value={storeData.address} onChange={e => setStoreData({...storeData, address: e.target.value})} className="min-h-[80px] bg-slate-50 resize-y" />
                </div>

                <Button type="submit" disabled={!isEditable || saving} className="mt-4 font-bold shadow-md shadow-primary/20">
                  {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                  Save Changes
                </Button>
                {!isEditable && <p className="text-[10px] text-rose-500 text-center mt-1">Only store owners can edit these details.</p>}
             </form>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-primary/5 text-primary rounded-lg"><Bell size={20} /></div>
            <CardTitle className="text-lg font-bold">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <p className="text-sm text-muted-foreground italic">Email alerts for low stock and upcoming expiries.</p>
             
             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
               <div>
                 <h4 className="font-bold text-sm">Inventory Alerts</h4>
                 <p className="text-xs text-muted-foreground mt-1">Receive daily emails for expiring & low stock items.</p>
               </div>
               <input 
                 type="checkbox" 
                 className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
                 checked={alertsEnabled} 
                 onChange={(e) => setAlertsEnabled(e.target.checked)} 
               />
             </div>

             <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Email scheduling engine coming soon
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
