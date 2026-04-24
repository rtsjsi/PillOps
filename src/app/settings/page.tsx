'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Bell, Shield, User, Store } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8 animate-page-in">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground font-medium">Configure your pharmacy preferences and security.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-primary/5 text-primary rounded-lg"><Store size={20} /></div>
            <CardTitle className="text-lg font-bold">Store Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <p className="text-sm text-muted-foreground italic">Manage pharmacy contact details, GSTIN, and physical address.</p>
             <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Feature coming soon
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-primary/5 text-primary rounded-lg"><Bell size={20} /></div>
            <CardTitle className="text-lg font-bold">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <p className="text-sm text-muted-foreground italic">Email alerts for low stock and upcoming expiries.</p>
             <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Feature coming soon
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
