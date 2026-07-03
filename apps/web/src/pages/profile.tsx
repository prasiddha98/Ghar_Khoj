import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  Settings, ShieldCheck, ShieldAlert, Heart, Building, ChevronRight,
  MessageSquare, Star, MapPin, Users, LayoutDashboard, UserCheck, Phone, Mail,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { BackButton } from "@/components/back-button";
import { useToast } from "@/hooks/use-toast";
import { getGetTenantPreferencesQueryKey, useGetTenantPreferences, useUpsertTenantPreferences } from "@workspace/api-client-react";

export default function Profile() {
  const { user, userId, isLoading, isAdmin, isOwner, isTenant } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState({ city: "", roomType: "", tenantType: "", minBudget: "", maxBudget: "", parking: false });
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const upsertTenantPreferences = useUpsertTenantPreferences();
  const { data: tenantPreferences, isLoading: isPreferencesLoading } = useGetTenantPreferences(userId ?? 0, {
    query: {
      queryKey: getGetTenantPreferencesQueryKey(userId ?? 0),
      enabled: isTenant && !!userId,
      refetchOnWindowFocus: false,
    },
  });

  useEffect(() => {
    if (tenantPreferences) {
      setPreferences({
        city: tenantPreferences.city || "",
        roomType: tenantPreferences.roomType || "",
        tenantType: tenantPreferences.tenantType || "",
        minBudget: tenantPreferences.minBudget != null ? String(tenantPreferences.minBudget) : "",
        maxBudget: tenantPreferences.maxBudget != null ? String(tenantPreferences.maxBudget) : "",
        parking: Boolean(tenantPreferences.parking),
      });
    }
  }, [tenantPreferences]);

  const savePreferences = async () => {
    if (!userId) return;
    setIsSavingPreferences(true);
    try {
      await upsertTenantPreferences.mutateAsync({
        userId,
        data: {
          city: preferences.city || null,
          roomType: preferences.roomType || null,
          tenantType: preferences.tenantType || null,
          minBudget: preferences.minBudget ? Number(preferences.minBudget) : null,
          maxBudget: preferences.maxBudget ? Number(preferences.maxBudget) : null,
          parking: preferences.parking || null,
        },
      });
      toast({ title: "Preferences updated", description: "Your room match preferences are saved." });
    } catch (error) {
      toast({ title: "Unable to save preferences", description: "Please try again shortly.", variant: "destructive" });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="bg-white rounded-3xl h-64 border" />
        <div className="bg-white rounded-3xl h-48 border" />
      </div>
    );
  }

  if (!user) return null;

  const roleColor = isAdmin
    ? "from-secondary to-blue-800"
    : isOwner
    ? "from-green-500 to-emerald-600"
    : "from-primary to-rose-600";

  const roleBadge = isAdmin
    ? { label: "Administrator", bg: "bg-secondary/10 text-secondary border-secondary/20" }
    : isOwner
    ? { label: "Room Owner", bg: "bg-green-100 text-green-700 border-green-200" }
    : { label: "Tenant", bg: "bg-primary/10 text-primary border-primary/20" };

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      <div>
        <BackButton fallback="/" label="Back" className="" />
      </div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border shadow-sm overflow-hidden"
      >
        {/* Banner */}
        <div className={`h-28 bg-gradient-to-r ${roleColor}`} />

        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
              {user.profilePhoto ? (
                <img src={user.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className={`text-3xl font-black text-white bg-gradient-to-br ${roleColor} w-full h-full flex items-center justify-center`}>
                  {user.firstName[0]}
                </span>
              )}
            </div>
            <div className="flex gap-2 mb-2">
              <Badge className={`${roleBadge.bg} border px-3 py-1 font-semibold text-xs`}>{roleBadge.label}</Badge>
              {user.isVerified ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 border px-3 py-1 font-semibold text-xs flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 border px-3 py-1 font-semibold text-xs flex items-center gap-1">
                  <ShieldAlert size={12} /> Unverified
                </Badge>
              )}
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-foreground">{user.firstName} {user.lastName}</h1>
          <div className="flex flex-col gap-1 mt-2">
            <p className="text-foreground text-sm flex items-center gap-2"><Mail size={13} className="text-primary" /> <span className="font-medium">{user.email || "No email set"}</span></p>
            {user.phone && <p className="text-foreground text-sm flex items-center gap-2"><Phone size={13} className="text-primary" /> <span className="font-medium">{user.phone}</span></p>}
            {user.preferredCity && <p className="text-foreground text-sm flex items-center gap-2"><MapPin size={13} className="text-primary" /> <span className="font-medium">Prefers {user.preferredCity}</span></p>}
          </div>
          {user.bio && <p className="text-foreground text-sm mt-3 bg-muted/40 rounded-xl p-3 italic">"{user.bio}"</p>}
        </div>
      </motion.div>

      {/* Verification Banner */}
      {!user.isVerified && !isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 text-white flex items-center justify-between shadow-lg shadow-amber-400/20"
        >
          <div>
            <h3 className="font-bold text-base flex items-center gap-2"><ShieldAlert size={18} /> Verify Your Identity</h3>
            <p className="text-white/80 text-sm mt-0.5">Unlock messaging, matching, and more features.</p>
          </div>
          <Link href="/verification">
            <Button className="bg-white text-amber-600 hover:bg-gray-50 rounded-xl font-bold shrink-0">Verify Now</Button>
          </Link>
        </motion.div>
      )}

      {isTenant && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl border shadow-sm overflow-hidden"
        >
          <div className="p-4 border-b bg-muted/20">
            <h3 className="font-bold text-sm text-muted-foreground px-2 uppercase tracking-wide">Tenant Preferences</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Preferred City</label>
                <select value={preferences.city} onChange={(e) => setPreferences((prev) => ({ ...prev, city: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Any city</option>
                  {['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Pokhara', 'Biratnagar', 'Birgunj', 'Dharan', 'Butwal', 'Hetauda', 'Nepalgunj'].map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Room Type</label>
                <select value={preferences.roomType} onChange={(e) => setPreferences((prev) => ({ ...prev, roomType: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Any type</option>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="flat">Flat</option>
                  <option value="studio">Studio</option>
                  <option value="shared">Shared</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Preferred For</label>
                <select value={preferences.tenantType} onChange={(e) => setPreferences((prev) => ({ ...prev, tenantType: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Anyone</option>
                  <option value="student">Student</option>
                  <option value="family">Family</option>
                  <option value="professional">Professional</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Budget Range (NPR/month)</label>
                <div className="flex gap-2">
                  <input type="number" value={preferences.minBudget} onChange={(e) => setPreferences((prev) => ({ ...prev, minBudget: e.target.value }))} placeholder="Min" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input type="number" value={preferences.maxBudget} onChange={(e) => setPreferences((prev) => ({ ...prev, maxBudget: e.target.value }))} placeholder="Max" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={preferences.parking} onChange={(e) => setPreferences((prev) => ({ ...prev, parking: e.target.checked }))} />
              <span>Parking is important</span>
            </label>
            <Button onClick={savePreferences} disabled={isSavingPreferences || isPreferencesLoading} className="rounded-xl">
              {isSavingPreferences ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Role-specific Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-3xl border shadow-sm overflow-hidden"
      >
        <div className="p-4 border-b bg-muted/20">
          <h3 className="font-bold text-sm text-muted-foreground px-2 uppercase tracking-wide">
            {isAdmin ? "Admin Actions" : isOwner ? "Owner Tools" : "My Activity"}
          </h3>
        </div>

        <div className="divide-y divide-border">
          {isAdmin && (
            <>
              <ProfileMenuItem href="/admin" icon={LayoutDashboard} iconBg="bg-secondary/10 text-secondary" title="Admin Dashboard" subtitle="Manage users, rooms & verifications" />
            </>
          )}

          {isOwner && (
            <>
              <ProfileMenuItem href="/my-listings" icon={Building} iconBg="bg-green-100 text-green-600" title="My Listings" subtitle="Manage your room properties" />
              <ProfileMenuItem href="/post" icon={Heart} iconBg="bg-primary/10 text-primary" title="Post New Room" subtitle="Add a new room listing" />
              {user.isVerified && (
                <>
                  <ProfileMenuItem href="/matches" icon={Users} iconBg="bg-blue-100 text-blue-600" title="Interested Tenants" subtitle="Tenants who want your rooms" />
                  <ProfileMenuItem href="/messages" icon={MessageSquare} iconBg="bg-purple-100 text-purple-600" title="Messages" subtitle="Chat with potential tenants" />
                  <ProfileMenuItem href="/contracts" icon={FileText} iconBg="bg-amber-100 text-amber-600" title="Contracts" subtitle="View and sign rental agreements" />
                </>
              )}
            </>
          )}

          {isTenant && (
            <>
              <ProfileMenuItem href="/recommendations" icon={Star} iconBg="bg-amber-100 text-amber-600" title="AI Recommendations" subtitle="Rooms picked just for you" />
              {user.isVerified && (
                <>
                  <ProfileMenuItem href="/matches" icon={Heart} iconBg="bg-primary/10 text-primary" title="My Matches" subtitle="Rooms you've shown interest in" />
                  <ProfileMenuItem href="/messages" icon={MessageSquare} iconBg="bg-blue-100 text-blue-600" title="Messages" subtitle="Chat with room owners" />
                  <ProfileMenuItem href="/contracts" icon={FileText} iconBg="bg-green-100 text-green-600" title="Contracts" subtitle="View and sign rental agreements" />
                </>
              )}
              {!user.isVerified && (
                <ProfileMenuItem href="/verification" icon={ShieldCheck} iconBg="bg-green-100 text-green-600" title="Verify Identity" subtitle="Upload ID to unlock features" />
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ProfileMenuItem({ href, icon: Icon, iconBg, title, subtitle }: {
  href: string; icon: any; iconBg: string; title: string; subtitle: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
      <div className="flex items-center gap-4">
        <div className={`${iconBg} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="font-bold text-foreground text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <ChevronRight size={16} className="text-muted-foreground" />
    </Link>
  );
}
