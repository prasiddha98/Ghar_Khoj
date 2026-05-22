import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { BackButton } from "@/components/back-button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Home, ShieldCheck, MessageSquare, BarChart2, CheckCircle2,
  Building, AlertTriangle, Trash2, RefreshCw, XCircle, Crown, Key,
  ChevronDown, ChevronLeft, ChevronRight, UserCog, Search, Eye, TrendingUp, Clock, Star, Ban,
  FileText, PenLine, ArrowLeft, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ContractViewer } from "@/components/contract-viewer";
import { customFetchRaw } from "@/lib/customFetch";
import { useToast } from "@/hooks/use-toast";
import { cn, getMediaUrl } from "@/lib/utils";

type Tab = "overview" | "verifications" | "users" | "rooms" | "contracts";

interface Stats {
  totalUsers: number; totalRooms: number; pendingVerifications: number;
  totalMessages: number; verifiedUsers: number; availableRooms: number;
  unverifiedRooms: number;
}
interface VDoc {
  id: number; userId: number; docType: string; docUrl?: string;
  selfieUrl?: string; status: string; adminNote?: string; createdAt: string;
  citizenshipNumber?: string; fullNameCitizenship?: string;
  dateOfBirth?: string; issueDate?: string; docPhotoUrl?: string;
}
interface AdminUser {
  id: number; firstName: string; lastName?: string; email: string;
  role: string; isVerified: boolean; verificationStatus: string; createdAt: string;
}
interface Room {
  id: number; title: string; city: string; price: number; roomType: string;
  isVerified: boolean; isAvailable: boolean; ownerId: number; createdAt: string;
}
interface AdminContract {
  id: number; matchId: number; tenantId: number; ownerId: number; roomId: number;
  rentAmount: number; startDate: string; endDate: string; terms?: string; contractPdfUrl?: string;
  ownerSignature?: string; tenantSignature?: string;
  status: string; adminNote?: string; createdAt: string;
  tenant?: { id: number; firstName: string; lastName?: string; email: string };
  owner?: { id: number; firstName: string; lastName?: string; email: string };
  room?: { id: number; title: string; city: string; address: string; price: number };
}

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const refetch = () => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("ghar_khoj_jwt");
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    customFetchRaw(url, { headers })
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error((data as any)?.message || r.statusText);
        setData(data as T);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  };
  useEffect(() => { refetch(); }, [url]);
  return { data, loading, refetch };
}

function resolveVerificationImageUrl(rawUrl?: string | null) {
  if (!rawUrl || rawUrl === "pending-upload") return undefined;
  return getMediaUrl(rawUrl) || undefined;
}

const ADMIN_CAPABILITIES = [
  { icon: ShieldCheck, color: "text-amber-500", bg: "bg-amber-50", title: "Verify Identities", desc: "Review citizen ID, NID & selfie documents and approve or reject user verification requests." },
  { icon: Building, color: "text-blue-500", bg: "bg-blue-50", title: "Verify Room Listings", desc: "Inspect submitted room listings and grant verified status so tenants see them as trusted." },
  { icon: UserCog, color: "text-purple-500", bg: "bg-purple-50", title: "Change User Roles", desc: "Promote tenants to owners, demote accounts, or grant admin access to trusted members." },
  { icon: Trash2, color: "text-red-500", bg: "bg-red-50", title: "Remove Content", desc: "Delete abusive, fraudulent, or policy-violating room listings from the platform." },
  { icon: FileText, color: "text-green-500", bg: "bg-green-50", title: "Verify Contracts", desc: "Review fully-signed rental contracts and issue official Ghar Khoj verification." },
  { icon: Ban, color: "text-rose-500", bg: "bg-rose-50", title: "Cannot Post Rooms", desc: "Admin accounts cannot post rooms or interact as tenants. Dedicated management role only." },
];

function StatCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: number | string; color: string; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-5 border shadow-sm">
      <div className={`inline-flex p-2.5 rounded-xl mb-3 ${color}`}><Icon size={20} /></div>
      <p className="text-2xl font-black text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1 bg-muted/40 rounded-lg px-2 py-0.5 w-fit">{sub}</p>}
    </motion.div>
  );
}

const CONTRACT_STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  owner_signed: "bg-blue-100 text-blue-700",
  tenant_signed: "bg-blue-100 text-blue-700",
  fully_signed: "bg-amber-100 text-amber-700",
  verified: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [roleTarget, setRoleTarget] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "owner" | "tenant">("all");
  const [roomSearch, setRoomSearch] = useState("");
  const [contractNote, setContractNote] = useState("");
  const [contractTarget, setContractTarget] = useState<number | null>(null);
  const [imageModal, setImageModal] = useState<{ url: string; type: string } | null>(null);
  const [viewingOwnerRooms, setViewingOwnerRooms] = useState<number | null>(null);
  const { toast } = useToast();

  const stats = useFetch<Stats>("/api/admin/stats");
  const verifications = useFetch<{ verifications: VDoc[] }>("/api/admin/verifications");
  const users = useFetch<{ users: AdminUser[]; total: number }>("/api/admin/users");
  const rooms = useFetch<{ rooms: Room[]; total: number }>("/api/admin/rooms");
  const contracts = useFetch<{ contracts: AdminContract[] }>("/api/admin/contracts");
  const ownerRooms = useFetch<{ rooms: Room[] }>(
    viewingOwnerRooms ? `/api/rooms/owner/${viewingOwnerRooms}` : ""
  );

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <AlertTriangle className="text-destructive" size={36} />
        </div>
        <h2 className="text-2xl font-extrabold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground max-w-sm mb-6">You need admin privileges to access this area.</p>
        <Link href="/"><Button>Go Home</Button></Link>
      </div>
    );
  }

  const getAuthHeaders = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("ghar_khoj_jwt");
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  const approve = async (docId: number) => {
    try {
      const r = await customFetchRaw(`/api/verification/${docId}/approve`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (r.ok) {
        toast({ title: "User verified!" });
        verifications.refetch();
        stats.refetch();
        users.refetch();
      } else {
        const error = await r.json();
        toast({ title: "Failed to approve verification", description: error.message || "Unknown error", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Failed to approve verification", description: "Network error", variant: "destructive" });
    }
  };

  const reject = async (docId: number, note: string) => {
    try {
      const r = await customFetchRaw(`/api/admin/verifications/${docId}/reject`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ note })
      });
      const result = await r.json().catch(() => null);
      if (r.ok) {
        toast({ title: "Verification rejected" });
        verifications.refetch();
        stats.refetch();
        setRejectTarget(null);
        setRejectNote("");
      } else {
        toast({ title: "Failed to reject verification", description: (result as any)?.message || "Unknown error", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Failed to reject verification", description: "Network error", variant: "destructive" });
    }
  };

  const changeRole = async (uid: number, role: string) => {
    const r = await customFetchRaw(`/api/admin/users/${uid}/role`, {
      method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ role })
    });
    if (r.ok) { toast({ title: `Role changed to ${role}` }); users.refetch(); setRoleTarget(null); }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm("Delete this user and all related data permanently?")) return;
    try {
      const r = await customFetchRaw(`/api/admin/users/${userId}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      if (r.ok) {
        toast({ title: "User deleted" });
        users.refetch();
        rooms.refetch();
        contracts.refetch();
        verifications.refetch();
        stats.refetch();
      } else {
        const error = await r.json().catch(() => null);
        toast({ title: "Failed to delete user", description: error?.message || "Unknown error", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Failed to delete user", description: "Network error", variant: "destructive" });
    }
  };

  const verifyRoom = async (roomId: number) => {
    const r = await customFetchRaw(`/api/admin/rooms/${roomId}/verify`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    if (r.ok) { toast({ title: "Room verified!" }); rooms.refetch(); stats.refetch(); }
  };

  const deleteRoom = async (roomId: number) => {
    if (!confirm("Delete this listing permanently?")) return;
    const r = await customFetchRaw(`/api/rooms/${roomId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (r.ok) { toast({ title: "Listing removed" }); rooms.refetch(); stats.refetch(); }
  };

  const verifyContract = async (id: number, decision: "verified" | "cancelled", note?: string) => {
    const r = await customFetchRaw(`/api/contracts/${id}/verify`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ decision, adminNote: note || "" }),
    });
    if (r.ok) {
      contracts.refetch();
      setContractTarget(null);
      setContractNote("");
    } else {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  const refetchAll = () => { stats.refetch(); verifications.refetch(); users.refetch(); rooms.refetch(); contracts.refetch(); };

  const filteredUsers = users.data?.users?.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())
    && (roleFilter === "all" || u.role === roleFilter)
  ) || [];

  const filteredRooms = rooms.data?.rooms?.filter(r =>
    `${r.title} ${r.city}`.toLowerCase().includes(roomSearch.toLowerCase())
  ) || [];

  const pendingContracts = contracts.data?.contracts?.filter(c => c.status === "fully_signed") || [];

  const tabs = [
    { id: "overview" as Tab, icon: BarChart2, label: "Overview" },
    { id: "verifications" as Tab, icon: ShieldCheck, label: "Verifications", badge: stats.data?.pendingVerifications },
    { id: "users" as Tab, icon: Users, label: "Users", badge: users.data?.total },
    { id: "rooms" as Tab, icon: Building, label: "Rooms", badge: stats.data?.unverifiedRooms },
    { id: "contracts" as Tab, icon: FileText, label: "Contracts", badge: pendingContracts.length || undefined },
  ];

  return (
    <div className="min-h-screen -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 bg-muted/20">
      <BackButton fallback="/" label="Back" className="absolute top-4 left-4 z-10" />
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-800 text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-10 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => window.history.back()}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
                <ArrowLeft size={16} /> Back
              </button>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 mb-3">
                  <Crown size={12} /> Admin Panel
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">Platform Management</h1>
                <p className="text-slate-200 text-sm md:text-base mt-2 max-w-2xl">
                  Welcome, {user?.firstName ?? "Administrator"}. You have full administrative access.
                </p>
              </div>
            </div>
            <button onClick={refetchAll}
              className="hidden md:inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div className="flex gap-0 overflow-x-auto rounded-3xl bg-white/10 p-1 shadow-inner backdrop-blur-sm">
            {!viewingOwnerRooms && tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition-all",
                  tab === t.id
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-200 hover:text-white/95 hover:bg-white/10"
                )}>
                <t.icon size={16} />
                <span>{t.label}</span>
                {!!t.badge && t.badge > 0 && (
                  <span className={cn("text-xs rounded-full min-w-[1.25rem] h-5 flex items-center justify-center font-bold",
                    t.id === "verifications" || t.id === "contracts" ? "bg-amber-400 text-amber-900" : "bg-slate-200 text-slate-800")}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

        {/* ══════════ VIEWING OWNER'S ROOMS ══════════ */}
        {viewingOwnerRooms && (
          <div className="space-y-4 mb-8">
            <button onClick={() => setViewingOwnerRooms(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 font-medium transition-colors">
              <ArrowLeft size={16} /> Back to Users
            </button>
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-bold text-lg">Rooms by Owner #{viewingOwnerRooms}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">All listings from this owner</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Room</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">City</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Price</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Status</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Listed</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ownerRooms.loading
                      ? <tr><td colSpan={6} className="p-4 text-center text-muted-foreground"><Loader2 className="animate-spin inline" size={16} /> Loading...</td></tr>
                      : !ownerRooms.data?.rooms?.length
                      ? <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No rooms from this owner</td></tr>
                      : ownerRooms.data.rooms.map(r => (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-4">
                            <p className="font-semibold line-clamp-1">{r.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{r.roomType}</p>
                          </td>
                          <td className="p-4 text-muted-foreground text-xs">{r.city}</td>
                          <td className="p-4 font-semibold">NPR {r.price.toLocaleString()}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              {r.isVerified
                                ? <span className="text-green-600 text-xs font-semibold flex items-center gap-1"><CheckCircle2 size={12} /> Verified</span>
                                : <span className="text-amber-600 text-xs font-semibold flex items-center gap-1"><Clock size={12} /> Unverified</span>}
                              {!r.isAvailable && <span className="text-red-600 text-xs font-medium">Rented</span>}
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleDateString("en-NP")}</td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Link href={`/room/${r.id}`}>
                                <button className="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors">
                                  <Eye size={12} /> View
                                </button>
                              </Link>
                              {!r.isVerified && (
                                <button onClick={() => verifyRoom(r.id)} className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors">
                                  <ShieldCheck size={12} /> Verify
                                </button>
                              )}
                              <button onClick={() => deleteRoom(r.id)} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors">
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ OVERVIEW ══════════ */}
        {tab === "overview" && !viewingOwnerRooms && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Users" value={stats.data?.totalUsers ?? 0} color="bg-blue-100 text-blue-600" />
              <StatCard icon={Building} label="Total Rooms" value={stats.data?.totalRooms ?? 0} color="bg-purple-100 text-purple-600" />
              <StatCard icon={ShieldCheck} label="Pending KYC" value={stats.data?.pendingVerifications ?? 0} color="bg-amber-100 text-amber-600" />
              <StatCard icon={MessageSquare} label="Total Messages" value={stats.data?.totalMessages ?? 0} color="bg-green-100 text-green-600" />
              <StatCard icon={CheckCircle2} label="Verified Users" value={stats.data?.verifiedUsers ?? 0} color="bg-emerald-100 text-emerald-600"
                sub={stats.data ? `${Math.round((stats.data.verifiedUsers / Math.max(stats.data.totalUsers, 1)) * 100)}% verified` : undefined} />
              <StatCard icon={Home} label="Available Rooms" value={stats.data?.availableRooms ?? 0} color="bg-sky-100 text-sky-600" />
              <StatCard icon={AlertTriangle} label="Unverified Rooms" value={stats.data?.unverifiedRooms ?? 0} color="bg-orange-100 text-orange-600" />
              <StatCard icon={FileText} label="Contracts to Review" value={pendingContracts.length} color="bg-teal-100 text-teal-600" />
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-gradient-to-r from-secondary/5 to-blue-50 flex items-center gap-3">
                <Key className="text-secondary" size={20} />
                <div>
                  <h3 className="font-bold text-foreground">Admin-Only Capabilities</h3>
                  <p className="text-xs text-muted-foreground">What you can uniquely do as an administrator</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
                {ADMIN_CAPABILITIES.map((cap, i) => (
                  <div key={i} className={cn("p-5 flex gap-4", i >= 3 && "border-t border-border")}>
                    <div className={`${cap.bg} p-3 rounded-xl h-fit shrink-0`}>
                      <cap.icon className={cap.color} size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{cap.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cap.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2"><ShieldCheck size={18} className="text-amber-500" /> Pending KYC</h3>
                  <button onClick={() => setTab("verifications")} className="text-primary text-xs font-semibold hover:underline">View all</button>
                </div>
                <div className="divide-y divide-border max-h-72 overflow-y-auto">
                  {verifications.data?.verifications.filter(v => v.status === "pending").length === 0
                    ? <p className="text-muted-foreground text-sm text-center py-8">No pending verifications</p>
                    : verifications.data?.verifications.filter(v => v.status === "pending").slice(0, 5).map(v => (
                      <div key={v.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="font-semibold text-sm">User #{v.userId}</p>
                          <p className="text-xs text-muted-foreground capitalize">{v.docType} • {new Date(v.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => approve(v.id)} className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors">Approve</button>
                          <button onClick={() => setRejectTarget(v.id)} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors">Reject</button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2"><FileText size={18} className="text-teal-500" /> Contracts Awaiting Verification</h3>
                  <button onClick={() => setTab("contracts")} className="text-primary text-xs font-semibold hover:underline">View all</button>
                </div>
                <div className="divide-y divide-border max-h-72 overflow-y-auto">
                  {pendingContracts.length === 0
                    ? <p className="text-muted-foreground text-sm text-center py-8">No contracts to review</p>
                    : pendingContracts.slice(0, 5).map(c => (
                      <div key={c.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="font-semibold text-sm">{c.room?.title || `Room #${c.roomId}`}</p>
                          <p className="text-xs text-muted-foreground">NPR {c.rentAmount.toLocaleString()} • {c.startDate}</p>
                        </div>
                        <button onClick={() => setTab("contracts")} className="bg-teal-500 hover:bg-teal-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors">Review</button>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ VERIFICATIONS ══════════ */}
        {tab === "verifications" && !viewingOwnerRooms && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {(["pending", "approved", "rejected"] as const).map(status => {
                const count = verifications.data?.verifications.filter(v => v.status === status).length ?? 0;
                return (
                  <div key={status} className={cn("rounded-2xl p-4 text-center border",
                    status === "pending" ? "bg-amber-50 border-amber-200" :
                    status === "approved" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                    <p className={cn("text-3xl font-black",
                      status === "pending" ? "text-amber-600" :
                      status === "approved" ? "text-green-600" : "text-red-600")}>{count}</p>
                    <p className="text-xs font-semibold text-muted-foreground capitalize mt-1">{status}</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-bold text-lg">Identity Verification Queue</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Review each document and approve or reject with a reason</p>
              </div>
              <div className="divide-y divide-border">
                {verifications.data?.verifications.length === 0 && (
                  <p className="text-center text-muted-foreground py-10">No verifications yet</p>
                )}
                {verifications.data?.verifications.map(v => (
                  <div key={v.id} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-blue-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          #{v.userId}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold">User #{v.userId}</p>
                          <p className="text-xs text-muted-foreground capitalize">{v.docType.replace("_", " ")} • Submitted {new Date(v.createdAt).toLocaleDateString("en-NP")}</p>
                        </div>
                        <Badge className={cn("ml-auto md:ml-0 text-xs capitalize px-3 py-1 shrink-0",
                          v.status === "approved" ? "bg-green-100 text-green-700 border-green-200" :
                          v.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" :
                          "bg-red-100 text-red-700 border-red-200")}>
                          {v.status === "pending" ? "⏳ Pending" : v.status === "approved" ? "✅ Approved" : "❌ Rejected"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-muted/30 rounded-xl p-3 mb-2 text-xs">
                        <div>
                          <p className="text-muted-foreground font-medium mb-0.5">Document Number</p>
                          <p className="font-mono font-semibold text-foreground">{v.citizenshipNumber || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium mb-0.5">Full Name</p>
                          <p className="font-semibold text-foreground">{v.fullNameCitizenship || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium mb-0.5">Date of Birth</p>
                          <p className="font-semibold text-foreground">{v.dateOfBirth || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium mb-0.5">Issue Date</p>
                          <p className="font-semibold text-foreground">{v.issueDate || "—"}</p>
                        </div>
                      </div>

                      {/* Document images */}
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        {(() => {
                          const docImageUrl = resolveVerificationImageUrl(v.docPhotoUrl) ?? resolveVerificationImageUrl(v.docUrl);
                          const selfieImageUrl = resolveVerificationImageUrl(v.selfieUrl);
                          return (
                            <>
                              <div className="rounded-2xl overflow-hidden border border-border bg-slate-50">
                                <div className="px-3 py-2 bg-slate-100 text-xs font-semibold text-slate-700">Document Photo</div>
                                {docImageUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setImageModal({ url: docImageUrl, type: "Document Photo" })}
                                    className="block w-full h-full"
                                  >
                                    <img
                                      src={docImageUrl}
                                      alt="Document photo"
                                      className="w-full h-32 object-cover"
                                      onError={(event) => {
                                        const target = event.currentTarget;
                                        target.onerror = null;
                                        target.src = getMediaUrl(`${import.meta.env.BASE_URL}images/empty-state.png`) || "/images/empty-state.png";
                                      }}
                                    />
                                  </button>
                                ) : (
                                  <div className="h-32 flex items-center justify-center px-3 text-xs text-muted-foreground">No document image available</div>
                                )}
                              </div>

                              <div className="rounded-2xl overflow-hidden border border-border bg-slate-50">
                                <div className="px-3 py-2 bg-slate-100 text-xs font-semibold text-slate-700">Selfie</div>
                                {selfieImageUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setImageModal({ url: selfieImageUrl, type: "Selfie" })}
                                    className="block w-full h-full"
                                  >
                                    <img
                                      src={selfieImageUrl}
                                      alt="Selfie"
                                      className="w-full h-32 object-cover"
                                      onError={(event) => {
                                        const target = event.currentTarget;
                                        target.onerror = null;
                                        target.src = getMediaUrl(`${import.meta.env.BASE_URL}images/empty-state.png`) || "/images/empty-state.png";
                                      }}
                                    />
                                  </button>
                                ) : (
                                  <div className="h-32 flex items-center justify-center px-3 text-xs text-muted-foreground">No selfie available</div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {v.adminNote && (
                        <p className="text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 mt-2">
                          <strong>Admin note:</strong> {v.adminNote}
                        </p>
                      )}
                    </div>
                    {v.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => approve(v.id)}
                          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                          <CheckCircle2 size={15} /> Approve
                        </button>
                        <button onClick={() => setRejectTarget(v.id)}
                          className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                          <XCircle size={15} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ USERS ══════════ */}
        {tab === "users" && !viewingOwnerRooms && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center gap-3">
                <div>
                  <h2 className="font-bold text-lg">All Users</h2>
                  <p className="text-xs text-muted-foreground">Change roles, view verification status</p>
                </div>
                <div className="relative sm:ml-auto flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-muted/10 rounded-xl p-1">
                    <button onClick={() => setRoleFilter("all")}
                      className={cn("text-xs px-3 py-1 rounded-lg font-medium", roleFilter === "all" ? "bg-white text-slate-900" : "text-muted-foreground hover:bg-white/5")}>All</button>
                    <button onClick={() => setRoleFilter("admin")}
                      className={cn("text-xs px-3 py-1 rounded-lg font-medium", roleFilter === "admin" ? "bg-white text-slate-900" : "text-muted-foreground hover:bg-white/5")}>Admins</button>
                    <button onClick={() => setRoleFilter("owner")}
                      className={cn("text-xs px-3 py-1 rounded-lg font-medium", roleFilter === "owner" ? "bg-white text-slate-900" : "text-muted-foreground hover:bg-white/5")}>Owners</button>
                    <button onClick={() => setRoleFilter("tenant")}
                      className={cn("text-xs px-3 py-1 rounded-lg font-medium", roleFilter === "tenant" ? "bg-white text-slate-900" : "text-muted-foreground hover:bg-white/5")}>Tenants</button>
                  </div>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                      placeholder="Search users..." className="pl-9 h-9 w-64 rounded-xl text-sm" />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">User</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Email</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Role</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Verification</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Joined</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold",
                              u.role === "admin" ? "bg-gradient-to-br from-secondary to-blue-800" :
                              u.role === "owner" ? "bg-gradient-to-br from-green-500 to-emerald-600" :
                              "bg-gradient-to-br from-primary to-rose-600")}>
                              {u.firstName[0]}
                            </div>
                            <div>
                              <p className="font-semibold">{u.firstName} {u.lastName}</p>
                              <p className="text-xs text-muted-foreground">#{u.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">{u.email}</td>
                        <td className="p-4">
                          <Badge className={cn("capitalize text-xs",
                            u.role === "admin" ? "bg-secondary/10 text-secondary border-secondary/20" :
                            u.role === "owner" ? "bg-green-100 text-green-700 border-green-200" :
                            "bg-primary/10 text-primary border-primary/20")}>
                            {u.role}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            {u.isVerified
                              ? <span className="flex items-center gap-1 text-green-600 text-xs font-semibold"><CheckCircle2 size={13} /> Verified</span>
                              : <span className="flex items-center gap-1 text-amber-600 text-xs font-semibold"><Clock size={13} /> {u.verificationStatus}</span>}
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString("en-NP")}</td>
                        <td className="p-4">
                          <div className="relative flex gap-2">
                            <button onClick={() => setRoleTarget(roleTarget === u.id ? null : u.id)}
                              className="flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-lg font-medium transition-colors">
                              <UserCog size={13} /> Change Role <ChevronDown size={12} />
                            </button>
                            {u.role === "owner" && (
                              <button onClick={() => setViewingOwnerRooms(u.id)}
                                className="flex items-center gap-1.5 text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium transition-colors">
                                <Home size={13} /> View Rooms
                              </button>
                            )}
                            {user?.id !== u.id ? (
                              <button onClick={() => deleteUser(u.id)}
                                className="flex items-center gap-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-semibold transition-colors">
                                <Trash2 size={12} /> Delete
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs bg-muted/20 text-muted-foreground px-3 py-1.5 rounded-lg">You</span>
                            )}
                            <AnimatePresence>
                              {roleTarget === u.id && (
                                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                                  className="absolute top-full left-0 mt-1 bg-white border rounded-xl shadow-lg z-20 overflow-hidden w-36">
                                  {["tenant", "owner", "admin"].map(role => (
                                    <button key={role} onClick={() => changeRole(u.id, role)}
                                      className={cn("w-full text-left px-4 py-2.5 text-sm hover:bg-muted capitalize transition-colors",
                                        u.role === role ? "font-bold text-primary" : "text-foreground")}>
                                      {role === "admin" ? "👑 admin" : role === "owner" ? "🏠 owner" : "🔍 tenant"}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ROOMS ══════════ */}
        {tab === "rooms" && !viewingOwnerRooms && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center gap-3">
                <div>
                  <h2 className="font-bold text-lg">All Room Listings</h2>
                  <p className="text-xs text-muted-foreground">Verify listings, remove violations</p>
                </div>
                <div className="relative sm:ml-auto">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={roomSearch} onChange={e => setRoomSearch(e.target.value)}
                    placeholder="Search rooms..." className="pl-9 h-9 w-64 rounded-xl text-sm" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Room</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">City</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Price</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Status</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Listed</th>
                      <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRooms.map(r => (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <p className="font-semibold line-clamp-1">{r.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{r.roomType}</p>
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">{r.city}</td>
                        <td className="p-4 font-semibold">NPR {r.price.toLocaleString()}</td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            {r.isVerified
                              ? <span className="text-green-600 text-xs font-semibold flex items-center gap-1"><CheckCircle2 size={12} /> Verified</span>
                              : <span className="text-amber-600 text-xs font-semibold flex items-center gap-1"><Clock size={12} /> Unverified</span>}
                            {!r.isAvailable && <span className="text-red-600 text-xs font-medium">Rented</span>}
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleDateString("en-NP")}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Link href={`/room/${r.id}`}>
                              <button className="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors">
                                <Eye size={12} /> View
                              </button>
                            </Link>
                            {!r.isVerified && (
                              <button onClick={() => verifyRoom(r.id)} className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors">
                                <ShieldCheck size={12} /> Verify
                              </button>
                            )}
                            <button onClick={() => deleteRoom(r.id)} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors">
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ CONTRACTS ══════════ */}
        {tab === "contracts" && !viewingOwnerRooms && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {(["fully_signed", "verified", "draft", "cancelled"] as const).map(status => {
                const count = contracts.data?.contracts.filter(c => c.status === status).length ?? 0;
                const labels: Record<string, string> = { fully_signed: "Awaiting Review", verified: "Verified", draft: "Draft / Signing", cancelled: "Cancelled" };
                const colors: Record<string, string> = { fully_signed: "bg-amber-50 border-amber-200 text-amber-700", verified: "bg-green-50 border-green-200 text-green-700", draft: "bg-muted border-border text-muted-foreground", cancelled: "bg-red-50 border-red-200 text-red-700" };
                return (
                  <div key={status} className={cn("rounded-2xl p-4 text-center border", colors[status])}>
                    <p className="text-3xl font-black">{count}</p>
                    <p className="text-xs font-semibold mt-1">{labels[status]}</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-bold text-lg">All Rental Contracts</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Verify fully-signed contracts to issue the official Ghar Khoj stamp</p>
              </div>
              <div className="divide-y divide-border">
                {!contracts.data?.contracts.length && (
                  <p className="text-center text-muted-foreground py-10">No contracts yet</p>
                )}
                {contracts.data?.contracts.map(c => {
                  const ownerName = c.owner ? `${c.owner.firstName} ${c.owner.lastName || ""}`.trim() : `Owner #${c.ownerId}`;
                  const tenantName = c.tenant ? `${c.tenant.firstName} ${c.tenant.lastName || ""}`.trim() : `Tenant #${c.tenantId}`;
                  return (
                    <div key={c.id} className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="font-bold">{c.room?.title || `Room #${c.roomId}`}</p>
                                <Badge className={cn("text-xs", CONTRACT_STATUS_COLOR[c.status] || "bg-muted text-muted-foreground")}>
                                  {c.status.replace(/_/g, " ")}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{c.room?.city} · NPR {c.rentAmount.toLocaleString()}/mo · {c.startDate} → {c.endDate}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-muted/30 rounded-xl p-3 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-0.5">Owner</p>
                              <p className="font-semibold">{ownerName}</p>
                              <p className="text-[10px] text-muted-foreground">{c.owner?.email}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Tenant</p>
                              <p className="font-semibold">{tenantName}</p>
                              <p className="text-[10px] text-muted-foreground">{c.tenant?.email}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Owner Signature</p>
                              <p className={cn("font-semibold", c.ownerSignature ? "text-green-600" : "text-muted-foreground")}>
                                {c.ownerSignature ? `"${c.ownerSignature}"` : "Not signed"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Tenant Signature</p>
                              <p className={cn("font-semibold", c.tenantSignature ? "text-green-600" : "text-muted-foreground")}>
                                {c.tenantSignature ? `"${c.tenantSignature}"` : "Not signed"}
                              </p>
                            </div>
                          </div>

                          {c.adminNote && (
                            <p className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-700 mt-2">
                              Admin note: {c.adminNote}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 shrink-0">
                          <ContractViewer contract={c} />
                          {c.status === "fully_signed" ? (
                            contractTarget === c.id ? (
                              <div className="space-y-2 p-3 border rounded-xl bg-muted/20 w-56">
                                <p className="text-xs font-semibold">Admin Note (optional)</p>
                                <Input
                                  value={contractNote}
                                  onChange={e => setContractNote(e.target.value)}
                                  placeholder="Add a note…"
                                  className="text-xs h-8 rounded-lg"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => verifyContract(c.id, "verified", contractNote)}
                                    className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1.5 rounded-lg font-semibold"
                                  >
                                    Verify
                                  </button>
                                  <button
                                    onClick={() => verifyContract(c.id, "cancelled", contractNote)}
                                    className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs px-2 py-1.5 rounded-lg font-semibold"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <button onClick={() => setContractTarget(null)} className="w-full text-xs text-muted-foreground">Dismiss</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setContractTarget(c.id)}
                                className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                              >
                                <ShieldCheck size={15} /> Review Contract
                              </button>
                            )
                          ) : c.status === "verified" ? (
                            <div className="flex items-center gap-1.5 text-green-600 text-sm font-semibold shrink-0">
                              <CheckCircle2 size={16} /> Verified
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Image Modal */}
      <AnimatePresence>
        {imageModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setImageModal(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-4 max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 gap-3">
                <div>
                  <h3 className="text-lg font-bold">{imageModal.type}</h3>
                </div>
                <button type="button" onClick={() => setImageModal(null)} className="text-muted-foreground hover:text-foreground">
                  <XCircle size={20} />
                </button>
              </div>
              <div className="relative bg-muted rounded-lg overflow-hidden">
                <img
                  src={getMediaUrl(imageModal.url) || imageModal.url}
                  alt={imageModal.type}
                  className="w-full max-h-[60vh] object-contain bg-black/5"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject KYC Modal */}
      <AnimatePresence>
        {rejectTarget !== null && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-bold mb-2 text-red-700 flex items-center gap-2"><XCircle size={20} /> Reject Verification</h3>
              <p className="text-sm text-muted-foreground mb-4">Provide a reason for rejection so the user can re-submit with correct documents.</p>
              <Input value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                placeholder="Optional: e.g. Document is blurry, name mismatch…" className="mb-4 rounded-xl" />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setRejectTarget(null); setRejectNote(""); }}>Cancel</Button>
                <Button variant="destructive" className="flex-1 rounded-xl" onClick={() => reject(rejectTarget!, rejectNote || "Rejected by admin")}>
                  Reject
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
