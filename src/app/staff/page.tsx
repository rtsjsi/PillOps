'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, Mail, ShieldCheck, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getStoreStaff, addStoreStaff, updateStaffRole, removeStaff } from '../actions';
import { toast } from "sonner";
import GlobalLoading from '../loading';

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'staff' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    try {
      const data = await getStoreStaff();
      setStaff(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setAdding(true);
    try {
      await addStoreStaff(newUser);
      toast.success("Staff member added successfully");
      setIsAddingUser(false);
      setNewUser({ fullName: '', email: '', password: '', role: 'staff' });
      await loadStaff();
    } catch (e: any) {
      toast.error(e.message || "Failed to add staff");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateStaffRole(userId, newRole);
      toast.success("Role updated");
      await loadStaff();
    } catch (e: any) {
      toast.error(e.message || "Failed to update role");
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await removeStaff(userId);
      toast.success("Staff member removed");
      await loadStaff();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove staff");
    }
  };

  if (loading) return <GlobalLoading />;

  return (
    <div className="flex flex-col gap-8 animate-page-in pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground font-medium">Manage pharmacy personnel and access roles.</p>
        </div>
        
        <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
          <DialogTrigger render={<Button className="rounded-xl h-11 font-bold shadow-lg shadow-primary/20" />}>
            <UserPlus size={18} className="mr-2" />
            Add Staff
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStaff} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input required value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} placeholder="e.g. Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email (Login ID)</Label>
                <Input required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="jane@pharmacy.com" />
              </div>
              <div className="space-y-2">
                <Label>Temporary Password</Label>
                <Input required type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="Min 6 characters" />
                <p className="text-xs text-muted-foreground mt-1">Provide this password to the new user. They can change it later.</p>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v || 'staff'})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff (Pharmacist)</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full mt-2" disabled={adding}>
                {adding ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Create Staff Account
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member) => (
          <Card key={member.id} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow relative group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-12 w-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center font-bold text-xl uppercase">
                {(member.full_name || member.email || 'U').charAt(0)}
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold uppercase tracking-widest text-[9px]">
                {member.role.replace('_', ' ')}
              </Badge>
            </CardHeader>
            <CardContent>
              <h3 className="text-lg font-black tracking-tight truncate pr-6">{member.full_name || 'No Name Set'}</h3>
              <div className="flex items-center gap-2 text-muted-foreground mt-1 mb-4 truncate">
                <Mail size={12} className="shrink-0" />
                <span className="text-xs font-medium truncate">{member.email}</span>
              </div>
              
              <div className="flex items-center gap-2 mt-4">
                <Select value={member.role} onValueChange={(r) => handleUpdateRole(member.id, r)}>
                  <SelectTrigger className="h-9 text-xs font-bold w-full bg-slate-50 border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="super_admin" disabled>Super Admin</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 shrink-0" onClick={() => handleRemoveStaff(member.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {staff.length === 0 && !loading && (
        <div className="p-16 text-center text-muted-foreground bg-white rounded-2xl border border-dashed border-slate-200">
            <Users size={32} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">No staff found for this store.</p>
        </div>
      )}
    </div>
  );
}
