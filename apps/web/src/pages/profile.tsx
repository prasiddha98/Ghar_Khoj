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

export default function Profile() {
  const { user, isLoading, isAdmin, isOwner, isTenant } = useAuth();

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
            <p className="text-muted-foreground text-sm flex items-center gap-2"><Mail size={13} /> {user.email}</p>
            {user.phone && <p className="text-muted-foreground text-sm flex items-center gap-2"><Phone size={13} /> {user.phone}</p>}
            {user.preferredCity && <p className="text-muted-foreground text-sm flex items-center gap-2"><MapPin size={13} /> Prefers {user.preferredCity}</p>}
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
              <ProfileMenuItem href="/admin" icon={UserCheck} iconBg="bg-amber-100 text-amber-600" title="Pending Verifications" subtitle="Review identity documents" />
              <ProfileMenuItem href="/admin" icon={Building} iconBg="bg-primary/10 text-primary" title="All Listings" subtitle="Manage room listings" />
              <ProfileMenuItem href="/admin" icon={Users} iconBg="bg-blue-100 text-blue-600" title="All Users" subtitle="View and manage user accounts" />
              <ProfileMenuItem href="/contracts" icon={FileText} iconBg="bg-green-100 text-green-600" title="Contracts" subtitle="Review and verify rental contracts" />
            </>
          )}

          {isOwner && (
            <>
              <ProfileMenuItem href="/my-listings" icon={Building} iconBg="bg-green-100 text-green-600" title="My Listings" subtitle="Manage your room properties" />
              <ProfileMenuItem href="/post" icon={Heart} iconBg="bg-primary/10 text-primary" title="Post New Room" subtitle="Add a new room listing" />
              <ProfileMenuItem href="/matches" icon={Users} iconBg="bg-blue-100 text-blue-600" title="Interested Tenants" subtitle="Tenants who want your rooms" />
              <ProfileMenuItem href="/messages" icon={MessageSquare} iconBg="bg-purple-100 text-purple-600" title="Messages" subtitle="Chat with potential tenants" />
              <ProfileMenuItem href="/contracts" icon={FileText} iconBg="bg-amber-100 text-amber-600" title="Contracts" subtitle="View and sign rental agreements" />
            </>
          )}

          {isTenant && (
            <>
              <ProfileMenuItem href="/recommendations" icon={Star} iconBg="bg-amber-100 text-amber-600" title="AI Recommendations" subtitle="Rooms picked just for you" />
              <ProfileMenuItem href="/matches" icon={Heart} iconBg="bg-primary/10 text-primary" title="My Matches" subtitle="Rooms you've shown interest in" />
              <ProfileMenuItem href="/messages" icon={MessageSquare} iconBg="bg-blue-100 text-blue-600" title="Messages" subtitle="Chat with room owners" />
              <ProfileMenuItem href="/contracts" icon={FileText} iconBg="bg-green-100 text-green-600" title="Contracts" subtitle="View and sign rental agreements" />
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
