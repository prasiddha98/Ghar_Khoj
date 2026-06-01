import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, MapPin, TrendingUp, ShieldCheck, Building, MessageSquare, Star } from "lucide-react";
import { isRealUserLoggedIn } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetRooms, useGetRecommendations, type RecommendationResult } from "@workspace/api-client-react";
import { RoomCard } from "@/components/room-card";
import { useAuth } from "@/hooks/use-auth";
import { useUserVisitedRoomTypes } from "@/hooks/use-user-visited-room-types";
import { sortRecommendations } from "@/lib/sort-recommendations";
import { motion } from "framer-motion";

const popularCities = ["Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Biratnagar"];


export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [hasRequestedRecommendations, setHasRequestedRecommendations] = useState(false);
  const [, setLocation] = useLocation();
  const { data: roomsData, isLoading: isRoomsLoading } = useGetRooms({ limit: 6, isVerified: true });
  const recommendationMutation = useGetRecommendations();
  const { user, userId, isAuthenticated, isVerified } = useAuth();
  const { visitedRoomTypes } = useUserVisitedRoomTypes();

  const getRandomNepalLocation = () => {
    const latitude = 26 + Math.random() * 3; // roughly Nepal bounds
    const longitude = 80 + Math.random() * 8;
    return { latitude, longitude };
  };

  const requestRecommendations = (latitude: number, longitude: number) => {
    recommendationMutation.mutate(
      { data: { userId: userId ?? 0, latitude, longitude, limit: 6 } },
      {
        onSuccess: (data) => {
          // Sort recommendations based on visited room types and other criteria
          const sortedRecommendations = sortRecommendations(data.results, visitedRoomTypes);
          setRecommendations(sortedRecommendations);
        }
      }
    );
  };

  useEffect(() => {
    if (!isAuthenticated || !userId || hasRequestedRecommendations) {
      return;
    }

    setHasRequestedRecommendations(true);

    const fetchDefaultRecommendations = () => {
      const fallbackLatitude = 27.7172;
      const fallbackLongitude = 85.3240;
      requestRecommendations(fallbackLatitude, fallbackLongitude);
    };

    if (!isVerified) {
      setGeoError(
        "Unverified users are shown recommendations from Kathmandu until verification. Verify your account to get location-based results from your current position."
      );
      fetchDefaultRecommendations();
      return;
    }

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Home geolocation success:", position.coords.latitude, position.coords.longitude);
          requestRecommendations(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.log("Home geolocation error:", error);
          setGeoError("Unable to fetch your location, using Kathmandu center for recommendations.");
          fetchDefaultRecommendations();
        },
        { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
      );
    } else {
      fetchDefaultRecommendations();
    }

  }, [hasRequestedRecommendations, isAuthenticated, userId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLocation(searchQuery.trim() ? `/search?city=${encodeURIComponent(searchQuery)}` : "/search");
  };

  return (
    <div className="flex flex-col gap-10 pb-10">
      {/* Hero Section */}
      <section className="relative w-full rounded-[2rem] overflow-hidden bg-secondary min-h-[480px] flex items-center justify-center px-6 md:px-12 pt-20 pb-24 isolate">
        <div className="absolute inset-0 z-0">
          <img src={`${import.meta.env.BASE_URL}images/hero-kathmandu.png`} alt="Kathmandu Illustration"
            className="w-full h-full object-cover object-bottom opacity-40 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-secondary/80 via-secondary/50 to-secondary" />
        </div>

        <div className="relative z-10 w-full max-w-3xl mx-auto flex flex-col items-center text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-block py-1.5 px-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold mb-6">
              Nepal's #1 Broker-Free Platform 🇳🇵
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Find your perfect <span className="text-primary bg-white px-2 rounded-lg inline-block -rotate-2 ml-1 shadow-lg">Ghar</span> without the hassle.
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto font-light">
              Connect directly with verified owners. No brokers, no hidden fees. Just you and your next home.
            </p>
          </motion.div>

          <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            onSubmit={handleSearch}
            className="w-full flex flex-col md:flex-row gap-3 bg-white/10 backdrop-blur-xl p-3 rounded-3xl border border-white/20 shadow-2xl">
            <div className="relative flex-1 flex items-center">
              <MapPin className="absolute left-4 text-white/70" size={20} />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by city (e.g., Kathmandu, Pokhara)..."
                className="w-full pl-12 h-14 bg-white/90 border-0 rounded-2xl text-lg text-foreground placeholder:text-muted-foreground focus-visible:ring-primary shadow-inner" />
            </div>
            <Button type="submit" size="lg" className="h-14 rounded-2xl px-8 text-lg w-full md:w-auto shadow-xl shadow-primary/30">
              <Search className="mr-2" size={20} /> Search
            </Button>
          </motion.form>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-2 mt-8 text-white/80 text-sm">
            <span>Popular:</span>
            {popularCities.map(city => (
              <Link key={city} href={`/search?city=${city}`}
                className="hover:text-white hover:underline transition-colors px-2 py-1 rounded-md hover:bg-white/10">{city}</Link>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Banner */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 md:px-0 -mt-16 relative z-20">
        {[
          { icon: ShieldCheck, bg: "bg-primary/10", color: "text-primary", title: "Verified Owners", desc: "Every listing requires citizenship verification for safety." },
          { icon: MessageSquare, bg: "bg-secondary/10", color: "text-secondary", title: "Direct Contact", desc: "Message owners directly — no middlemen, no broker commission." },
          { icon: TrendingUp, bg: "bg-green-500/10", color: "text-green-600", title: "Zero Broker Fees", desc: "Save your money. Deal directly with property owners." },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-xl shadow-black/5 border border-border flex items-start gap-4">
            <div className={`${item.bg} p-3 rounded-xl ${item.color}`}><item.icon size={28} /></div>
            <div>
              <h3 className="font-bold text-foreground text-lg">{item.title}</h3>
              <p className="text-muted-foreground text-sm mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Fresh Listings */}
      <section className="px-4 md:px-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              {isAuthenticated ? "Recommended for you" : "Freshly Listed"}
            </h2>
            <p className="text-muted-foreground mt-1">
              {isAuthenticated
                ? "Rooms ranked by relevance to your profile and activity."
                : "The latest rooms available in Nepal."}
            </p>
          </div>
          <Link href="/search" className="text-primary font-semibold hover:underline hidden md:block">View all</Link>
        </div>

        {geoError && !recommendations.length && (
          <div className="rounded-3xl border border-yellow-200 bg-yellow-50 text-yellow-900 px-5 py-4 mb-6">
            {geoError} We are showing the most relevant rooms using a central Nepal location.
          </div>
        )}

        {(recommendationMutation.status === "pending" && isAuthenticated) || isRoomsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl h-[340px] animate-pulse border border-border" />
            ))}
          </div>
        ) : isAuthenticated && recommendations.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((result, i) => (
              <motion.div key={result.roomId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }}>
                <RoomCard room={result.room} recommendationScore={result.finalScore} recommendationTag={result.tag} distanceKm={result.distanceKm} showDistance={false} />
              </motion.div>
            ))}
          </div>
        ) : roomsData?.rooms && roomsData.rooms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomsData.rooms.map((room, i) => (
              <motion.div key={room.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }}>
                <RoomCard room={room} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-border">
            <p className="text-muted-foreground text-lg">No rooms listed yet.</p>
          </div>
        )}

        <div className="mt-8 text-center md:hidden">
          <Link href="/search"><Button variant="outline" className="w-full">View all rooms</Button></Link>
        </div>
      </section>

      {/* Promo CTA */}
      <section className="mt-8 rounded-3xl bg-gradient-to-r from-primary to-rose-600 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between text-white relative overflow-hidden shadow-2xl shadow-primary/20 mx-4 md:mx-0">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 opacity-20 pointer-events-none"><Building size={200} /></div>
        <div className="relative z-10 max-w-lg mb-8 md:mb-0 text-center md:text-left">
          <h2 className="text-3xl font-bold mb-3">Have a room to rent?</h2>
          <p className="text-white/90 text-lg">Join thousands of verified owners finding great tenants quickly and securely.</p>
        </div>
        <div className="relative z-10 w-full md:w-auto">
          <Link href={isRealUserLoggedIn() ? "/post" : "/register"}>
            <Button size="lg" variant="secondary" className="w-full md:w-auto bg-white text-primary hover:bg-gray-100 rounded-2xl h-14 text-lg font-bold shadow-xl">
              {isRealUserLoggedIn() ? "Post Room for Free" : "Register as Owner"}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
