import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Heart, Lock, MessageSquare, Star, MapPin, CheckCircle2,
  XCircle, Clock, Home, Loader2, Sparkles, Building,
  ArrowRight, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/back-button";

interface Room {
  id: number; title: string; city: string; address: string; price: number;
  roomType: string; photos: string[]; amenities: string[]; parking: boolean;
}
interface MatchEntry {
  id: number; tenantId: number; ownerId: number; roomId: number;
  status: string; tenantStatus: string; ownerStatus: string;
  matchScore: number; createdAt: string;
  room?: Room;
  owner?: { id: number; firstName: string; lastName?: string; isVerified: boolean };
  tenant?: { id: number; firstName: string; lastName?: string; isVerified: boolean };
}

const STATUS_CONFIG = {
  pending: { label: "Awaiting Owner", icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-200" },
  accepted: { label: "Matched!", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
  rejected: { label: "Declined", icon: XCircle, color: "text-red-600 bg-red-50 border-red-200" },
};

function MatchCard({ match, isOwner, onRespond, onChat }: {
  match: MatchEntry; isOwner: boolean;
  onRespond: (id: number, decision: "accepted" | "rejected") => void;
  onChat: (partnerId: number) => void;
}) {
  const room = match.room;
  const partner = isOwner ? match.tenant : match.owner;
  const partnerName = partner ? `${partner.firstName} ${partner.lastName || ""}`.trim() : "Unknown";
  const status = STATUS_CONFIG[match.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;
  const isAccepted = match.status === "accepted";
  const ownerNeedsToRespond = isOwner && match.ownerStatus === "pending" && match.tenantStatus === "accepted";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Room photo strip */}
      <div className="relative h-36 bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
        {room?.photos?.[0] ? (
          <img src={room.photos[0]} alt={room?.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building size={40} className="text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div>
            <p className="text-white font-bold text-sm line-clamp-1">{room?.title || "Room"}</p>
            <p className="text-white/80 text-xs flex items-center gap-1"><MapPin size={10} />{room?.city}</p>
          </div>
          <span className="bg-white/90 text-primary font-bold text-xs px-2 py-1 rounded-lg">
            NPR {room?.price?.toLocaleString()}/mo
          </span>
        </div>
        {match.matchScore > 0 && (
          <div className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Star size={10} fill="white" /> {match.matchScore}% match
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Partner info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-rose-500 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            {partnerName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{partnerName}</p>
            <p className="text-xs text-muted-foreground capitalize">{isOwner ? "Interested Tenant" : "Room Owner"}</p>
          </div>
          <span className={cn("text-xs font-medium px-2 py-1 rounded-full border flex items-center gap-1", status.color)}>
            <StatusIcon size={11} /> {status.label}
          </span>
        </div>

        {/* Owner needs to respond */}
        {ownerNeedsToRespond && (
          <div className="flex gap-2 mb-3">
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl h-9 text-xs"
              onClick={() => onRespond(match.id, "accepted")}
            >
              <CheckCircle2 size={13} className="mr-1" /> Accept Tenant
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 rounded-xl h-9 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => onRespond(match.id, "rejected")}
            >
              <XCircle size={13} className="mr-1" /> Decline
            </Button>
          </div>
        )}

        {/* Chat button — only if accepted */}
        {isAccepted && partner && (
          <Button
            size="sm"
            className="w-full rounded-xl h-9 text-xs gap-2"
            onClick={() => onChat(partner.id)}
          >
            <MessageSquare size={13} /> Open Chat
          </Button>
        )}

        {/* View room */}
        <Link href={`/room/${match.roomId}`}>
          <Button size="sm" variant="ghost" className="w-full mt-1.5 rounded-xl h-8 text-xs text-muted-foreground">
            View Listing <ArrowRight size={12} className="ml-1" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

export default function MatchesPage() {
  const { user, userId, isOwner, isVerified } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<number | null>(null);

  const fetchMatches = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const url = isOwner
        ? `/api/matches/owner/${userId}`
        : `/api/matches/tenant/${userId}`;
      const res = await fetch(url);
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMatches(); }, [userId, isOwner]);

  const handleRespond = async (matchId: number, decision: "accepted" | "rejected") => {
    setResponding(matchId);
    try {
      const res = await fetch(`/api/matches/${matchId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "owner", decision }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: decision === "accepted" ? "Tenant accepted! Chat is now open." : "Match declined." });
      await fetchMatches();
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setResponding(null);
    }
  };

  const handleChat = (partnerId: number) => {
    navigate(`/messages/${userId}/${partnerId}`);
  };

  const active = matches.filter(m => m.status !== "rejected");
  const declined = matches.filter(m => m.status === "rejected");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallback="/matches" label="Back" className="" />
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <Heart className="text-primary" size={24} /> {isOwner ? "Interested Tenants" : "My Matches"}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isOwner
                ? "Tenants who showed interest in your listings"
                : "Rooms you liked — chat unlocks when the owner accepts you"}
            </p>
          </div>
        </div>
        {!isOwner && (
          <Button onClick={() => navigate("/search")} className="rounded-xl gap-2 hidden md:flex">
            <Sparkles size={15} /> Find Rooms
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : active.length === 0 && declined.length === 0 ? (
        <div className="bg-white rounded-3xl border shadow-sm p-16 text-center">
          <Heart size={48} className="text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">No matches yet</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {isOwner
              ? "When tenants show interest in your listings, they'll appear here."
              : "Browse rooms and click \"I'm Interested\" to start matching."}
          </p>
          {!isOwner && (
            <Button onClick={() => navigate("/search")} className="rounded-xl">
              Browse Rooms
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                Active Matches ({active.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map(m => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    isOwner={isOwner}
                    onRespond={handleRespond}
                    onChat={handleChat}
                  />
                ))}
              </div>
            </div>
          )}

          {declined.length > 0 && (
            <div>
              <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                Declined ({declined.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {declined.map(m => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    isOwner={isOwner}
                    onRespond={handleRespond}
                    onChat={handleChat}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
