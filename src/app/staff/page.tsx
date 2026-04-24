'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function StaffPage() {
  const staff = [
    { name: 'John Pharmacist', role: 'Admin', email: 'john@pillops.com' },
    { name: 'Sarah Assistant', role: 'Pharmacist', email: 'sarah@pillops.com' },
  ];

  return (
    <div className="flex flex-col gap-8 animate-page-in">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground font-medium">Manage pharmacy personnel and access roles.</p>
        </div>
        <Button className="rounded-xl h-11 font-bold shadow-lg shadow-primary/20">
          <UserPlus size={18} className="mr-2" />
          Add Staff
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member, i) => (
          <Card key={i} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center font-bold text-xl">
                {member.name.charAt(0)}
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold uppercase tracking-widest text-[9px]">
                {member.role}
              </Badge>
            </CardHeader>
            <CardContent>
              <h3 className="text-lg font-black tracking-tight">{member.name}</h3>
              <div className="flex items-center gap-2 text-muted-foreground mt-1 mb-4">
                <Mail size={12} />
                <span className="text-xs font-medium">{member.email}</span>
              </div>
              <Button variant="secondary" className="w-full rounded-xl text-xs font-bold py-5">Edit Permissions</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
