'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Shield, Key } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-8 animate-page-in">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Account Profile</h1>
        <p className="text-muted-foreground font-medium">Manage your personal credentials and identity.</p>
      </header>

      <div className="max-w-2xl">
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-32 bg-primary/10 w-full" />
          <CardContent className="p-8 -mt-16 flex flex-col items-center gap-6">
             <Avatar className="h-32 w-32 border-4 border-white shadow-xl">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary text-white text-3xl font-extrabold">JD</AvatarFallback>
             </Avatar>
             
             <div className="text-center">
                <h2 className="text-2xl font-black tracking-tight">John Pharmacist</h2>
                <p className="text-xs font-black uppercase tracking-widest text-primary/60">Administrator</p>
             </div>

             <div className="w-full grid grid-cols-1 gap-4 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                   <Mail className="text-primary/40" size={20} />
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</p>
                      <p className="text-sm font-bold">pharmacist@pillops.com</p>
                   </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                   <Shield className="text-primary/40" size={20} />
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account Role</p>
                      <p className="text-sm font-bold">Store Administrator</p>
                   </div>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
