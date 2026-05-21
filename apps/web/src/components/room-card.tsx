import { Link } from "wouter";
import { Heart, MapPin, CheckCircle2, BedDouble, Users, Car } from "lucide-react";
import { Room } from "@workspace/api-client-react";
import { formatCurrency, cn, getMediaUrl } from "@/lib/utils";
import { useCreateInteraction } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface RoomCardProps {
  room: Room;
  recommendationScore?: number;
  recommendationTag?: string;
  className?: string;
}

export function RoomCard({ room, recommendationScore, recommendationTag, className }: RoomCardProps) {
  const { userId, isVerified } = useAuth();
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  
  const saveMutation = useCreateInteraction({
    mutation: {
      onSuccess: () => {
        setIsSaved(true);
        toast({
          title: "Room Saved ❤️",
          description: "You can find it in your profile.",
        });
      }
    }
  });

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSaved) {
      saveMutation.mutate({
        data: {
          roomId: room.id,
          userId: userId,
          type: "save"
        }
      });
    } else {
      setIsSaved(false);
      // Ideally we'd have a delete interaction endpoint
    }
  };

  const imageToUse = room.photos && room.photos.length > 0 
    ? getMediaUrl(room.photos[0])
    : getMediaUrl(`${import.meta.env.BASE_URL}images/empty-state.png`);

  return (
    <Link href={`/room/${room.id}`} className={cn("block group", className)}>
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col relative">
        
        {/* Badges - Only show to verified users */}
        {isVerified && (
          <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
            {room.isVerified && (
              <div className="bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1 backdrop-blur-md">
                <CheckCircle2 size={12} /> Verified
              </div>
            )}
            {recommendationTag && (
              <div className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-md max-w-[150px] truncate backdrop-blur-md">
                ✨ {recommendationTag}
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <button 
          onClick={handleSave}
          className="absolute top-3 right-3 z-10 p-2.5 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-all active:scale-90"
        >
          <Heart size={18} className={cn(isSaved ? "fill-primary text-primary" : "fill-transparent")} />
        </button>

        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img 
            src={imageToUse} 
            alt={room.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors text-lg">
              {room.title}
            </h3>
          </div>
          
          <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
            <MapPin size={14} className="text-primary/70 shrink-0" />
            <span className="truncate">{room.address}, {room.city}</span>
          </p>

          <div className="flex flex-wrap gap-2 mb-4 mt-auto">
            <div className="flex items-center gap-1.5 text-xs font-medium bg-muted/50 px-2 py-1.5 rounded-md text-foreground">
              <BedDouble size={14} className="text-primary/70" />
              <span className="capitalize">{room.roomType}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium bg-muted/50 px-2 py-1.5 rounded-md text-foreground">
              <Users size={14} className="text-secondary/70" />
              <span className="capitalize">{room.tenantType}</span>
            </div>
            {room.parking && (
              <div className="flex items-center gap-1.5 text-xs font-medium bg-muted/50 px-2 py-1.5 rounded-md text-foreground">
                <Car size={14} className="text-green-600/70" />
                <span>Parking</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <span className="text-xl font-bold text-primary">{formatCurrency(room.price)}</span>
              <span className="text-xs text-muted-foreground font-medium"> /month</span>
            </div>
            {isVerified && recommendationScore !== undefined && recommendationScore !== null && (
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-md">
                  {Math.round(recommendationScore * 100)}% Match
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
