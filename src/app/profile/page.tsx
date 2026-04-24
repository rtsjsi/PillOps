import { getUserProfile } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Store, Mail, Phone, MapPin, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default async function ProfilePage() {
  const { user, profile } = await getUserProfile();

  return (
    <div className="container py-8 flex flex-col gap-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
        <p className="text-muted-foreground">Manage your account and store settings</p>
      </section>

      <div className="grid grid-cols-1 gap-6">
        {/* User Info */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <div className="bg-primary/10 p-4 rounded-2xl text-primary">
              <User size={32} />
            </div>
            <div>
              <CardTitle className="text-xl">{profile?.fullName || 'Staff Member'}</CardTitle>
              <p className="text-sm text-muted-foreground">{profile?.role?.toUpperCase()} • {user.email}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Mail size={18} />
              <span>{user.email}</span>
            </div>
          </CardContent>
        </Card>

        {/* Store Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Store size={20} className="text-muted-foreground" />
              Store Information
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted-foreground">Store Name</label>
              <div className="font-semibold">{profile?.store?.name}</div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <MapPin size={18} className="text-muted-foreground" />
              <span>{profile?.store?.address || 'Not specified'}</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Phone size={18} className="text-muted-foreground" />
              <span>{profile?.store?.phone || 'Not specified'}</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <CreditCard size={18} className="text-muted-foreground" />
              <span>GSTIN: {profile?.store?.gstin || 'Not specified'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">Subscription Plan</h3>
              <p className="text-sm text-muted-foreground">Your current billing cycle</p>
            </div>
            <Badge variant="default" className="px-4 py-1 text-sm rounded-full">
              {profile?.store?.subscriptionTier?.toUpperCase() || 'FREE'}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

