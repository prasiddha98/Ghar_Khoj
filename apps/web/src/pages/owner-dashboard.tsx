import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { BackButton } from "@/components/back-button";
import { customFetchRaw } from "@/lib/customFetch";
import { motion } from "framer-motion";
import {
  Building, PlusCircle, Eye, EyeOff, Trash2, CheckCircle2, MapPin,
  TrendingUp, MessageSquare, Key, Home, Star, Users, AlertTriangle, ChevronRight, LightbulbIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn, getMediaUrl } from "@/lib/utils";

interface Room {
  id: number; title: string; city: string; address: string; price: number;
  roomType: string; tenantType: string; isVerified: boolean; isAvailable: boolean;
  photos: string[]; amenities: string[]; createdAt: string;
  hasActiveContract?: boolean;
}

function useOwnerRooms(ownerId: number) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = () => {
    setLoading(true);
    const token = localStorage.getItem("ghar_khoj_jwt");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    customFetchRaw(`/api/rooms/owner/${ownerId}`, { headers })
      .then(r => r.json())
      .then(d => { setRooms(d.rooms || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { refetch(); }, [ownerId]);
  return { rooms, loading, refetch, setRooms };
}

const OWNER_CAPABILITIES = [
  { icon: PlusCircle, color: "text-primary", bg: "bg-primary/10", title: "Post Room Listings", desc: "Create detailed listings with photos, amenities, GPS location and pricing." },
  { icon: Eye, color: "text-blue-500", bg: "bg-blue-100", title: "Manage Availability", desc: "Mark rooms as available or rented. Tenants see real-time status." },
  { icon: MessageSquare, color: "text-green-500", bg: "bg-green-100", title: "Chat with Tenants", desc: "Receive inquiries from verified tenants and reply directly in the platform." },
  { icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-100", title: "Track Performance", desc: "See how many tenants have saved or viewed each of your listings." },
  { icon: CheckCircle2, color: "text-amber-500", bg: "bg-amber-100", title: "Get Verified Badge", desc: "Verify your identity to earn a badge that boosts tenant trust and inquiries." },
  { icon: AlertTriangle, color: "text-muted-foreground", bg: "bg-muted", title: "Cannot Browse as Tenant", desc: "Owner accounts focus on managing listings. Use a tenant account to browse." },
];

export default function OwnerDashboard() {
  const { user, userId, isOwner } = useAuth();
  const { rooms, loading, refetch, setRooms } = useOwnerRooms(userId);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"listings" | "capabilities">("listings");

  const toggleAvailability = async (room: Room) => {
    const token = localStorage.getItem("ghar_khoj_jwt");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const r = await customFetchRaw(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isAvailable: !room.isAvailable }),
      });

      const body = await r.json().catch(() => null);
      if (!r.ok) {
        toast({ title: "Failed to update availability", description: body?.message || "Please try again.", variant: "destructive" });
        return;
      }

      const updatedAvailability = typeof body?.isAvailable === "boolean" ? body.isAvailable : !room.isAvailable;
      setRooms(current => current.map(item => item.id === room.id ? { ...item, isAvailable: updatedAvailability } : item));
      toast({ title: `Room marked as ${updatedAvailability ? "available" : "rented"}` });
      refetch();
    } catch (error) {
      toast({ title: "Failed to update availability", description: (error as Error)?.message || "Network error.", variant: "destructive" });
    }
  };

  const deleteRoom = async (roomId: number) => {
    if (!confirm("Delete this listing permanently?")) return;
    
    const token = localStorage.getItem("ghar_khoj_jwt");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const r = await customFetchRaw(`/api/rooms/${roomId}`, { method: "DELETE", headers });
    if (r.ok) { toast({ title: "Listing deleted" }); refetch(); }
  };

  if (!isOwner) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Building size={48} className="mx-auto mb-4 opacity-30" />
        <p className="font-semibold">You need an owner account to access this page.</p>
        <p className="text-sm mt-1">Switch accounts from the top-right menu.</p>
      </div>
    );
  }

  const stats = {
    total: rooms.length,
    available: rooms.filter(r => r.isAvailable).length,
    verified: rooms.filter(r => r.isVerified).length,
    rented: rooms.filter(r => !r.isAvailable).length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <BackButton fallback="/" label="Back" className="" />
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-500/20">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-emerald-100 text-sm font-semibold mb-2">Owner Dashboard</p>
            <h1 className="text-4xl font-extrabold">Welcome, {user?.firstName}!</h1>
            <p className="text-emerald-100/90 mt-3 text-base max-w-md">
              Manage your room listings, respond to tenant inquiries, and grow your rental business.
            </p>
          </div>
          <Link href="/post">
            <Button className="bg-white text-emerald-700 hover:bg-emerald-50 rounded-2xl font-bold shadow-lg gap-2 shrink-0">
              <PlusCircle size={16} /> New Listing
            </Button>
          </Link>
        </div>

        {/* Stats inside hero */}
        <div className="grid grid-cols-4 gap-3 mt-6">
          {[
            { label: "Total", value: stats.total },
            { label: "Available", value: stats.available },
            { label: "Rented", value: stats.rented },
            { label: "Verified", value: stats.verified },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-4 text-center">
              <p className="text-3xl font-black text-white">{s.value}</p>
              <p className="text-sm text-emerald-100 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-muted/30 p-1.5 rounded-2xl w-fit">
        <button onClick={() => setActiveTab("listings")}
          className={cn("px-5 py-2 rounded-xl text-sm font-semibold transition-all",
            activeTab === "listings" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
          My Listings
        </button>
        <button onClick={() => setActiveTab("capabilities")}
          className={cn("px-5 py-2 rounded-xl text-sm font-semibold transition-all",
            activeTab === "capabilities" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
          Owner Capabilities
        </button>
      </div>

      {/* LISTINGS TAB */}
      {activeTab === "listings" && (
        <>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl border h-32 animate-pulse" />)}
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border shadow-sm">
              <Building size={56} className="mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-xl font-bold mb-2">No listings yet</h3>
              <p className="text-muted-foreground mb-6 text-sm">Post your first room and start receiving tenant inquiries</p>
              <Link href="/post"><Button className="bg-primary rounded-xl px-8">Post Your First Room</Button></Link>
            </div>
          ) : (
            <div className="space-y-4">
              {rooms.map((room, i) => (
                <motion.div key={room.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {/* Photo */}
                    <div className="md:w-44 h-44 md:h-auto relative shrink-0 bg-muted">
                      <img src={getMediaUrl(room.photos?.[0]) || getMediaUrl(`${import.meta.env.BASE_URL}images/empty-state.png`)}
                        alt={room.title} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {room.isVerified
                          ? <span className="bg-green-500/90 backdrop-blur text-white text-xs px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1"><CheckCircle2 size={10} /> Verified</span>
                          : <span className="bg-amber-500/90 backdrop-blur text-white text-xs px-2 py-0.5 rounded-lg font-semibold">Pending</span>}
                        {!room.isAvailable && <span className="bg-gray-800/90 backdrop-blur text-white text-xs px-2 py-0.5 rounded-lg font-semibold">Rented</span>}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <h3 className="font-bold text-base text-foreground leading-tight">{room.title}</h3>
                          <p className="text-primary font-extrabold text-base whitespace-nowrap shrink-0">
                            NPR {room.price.toLocaleString()}<span className="text-muted-foreground font-normal text-xs">/mo</span>
                          </p>
                        </div>
                        <p className="text-muted-foreground text-sm flex items-center gap-1 mb-3">
                          <MapPin size={12} /> {room.address}, {room.city}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="capitalize text-xs rounded-lg">{room.roomType}</Badge>
                          <Badge variant="secondary" className="capitalize text-xs rounded-lg">{room.tenantType}</Badge>
                          {room.amenities.slice(0, 3).map(a => (
                            <Badge key={a} variant="outline" className="text-xs rounded-lg">{a}</Badge>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border">
                        <Link href={`/room/${room.id}`}>
                          <button className="flex items-center gap-1.5 text-xs text-secondary hover:bg-secondary/10 px-3 py-1.5 rounded-lg transition-colors font-semibold border border-secondary/20">
                            <Eye size={13} /> View Listing
                          </button>
                        </Link>
                        <Link href={`/messages`}>
                          <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors font-semibold border border-blue-200">
                            <MessageSquare size={13} /> View Messages
                          </button>
                        </Link>
                        <button onClick={() => toggleAvailability(room)}
                          disabled={!room.isAvailable && room.hasActiveContract}
                          className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-semibold border",
                            room.isAvailable
                              ? "text-gray-600 hover:bg-gray-50 border-gray-200"
                              : room.hasActiveContract
                                ? "text-muted-foreground bg-muted/50 border-muted"
                                : "text-green-600 hover:bg-green-50 border-green-200")}>
                          {room.isAvailable
                            ? <><EyeOff size={13} /> Mark Rented</>
                            : room.hasActiveContract
                              ? <><Eye size={13} /> Rented (Contract Active)</>
                              : <><Eye size={13} /> Mark Available</>}
                        </button>
                        <button onClick={() => deleteRoom(room.id)}
                          className="ml-auto flex items-center gap-1.5 text-xs text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors font-semibold border border-destructive/20">
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* CAPABILITIES TAB */}
      {activeTab === "capabilities" && (
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b bg-gradient-to-r from-green-50 to-emerald-50 flex items-center gap-3">
            <LightbulbIcon className="text-green-600" size={22} />
            <div>
              <h3 className="font-bold text-foreground">What Owners Can Do</h3>
              <p className="text-xs text-muted-foreground mt-0.5">A complete overview of your account's capabilities</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-0 divide-y divide-border">
            {OWNER_CAPABILITIES.map((cap, i) => (
              <div key={i} className={cn("p-5 flex gap-4", i >= 2 && "md:border-t-0")}>
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
          <div className="p-5 border-t bg-muted/20 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Ready to post your first listing?</p>
            <Link href="/post">
              <Button className="bg-primary rounded-xl gap-2 text-sm"><PlusCircle size={15} /> Post a Room</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
