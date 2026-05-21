import { useState, useEffect } from "react";
import { useGetRecommendations } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, Compass, Lock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { RoomCard } from "@/components/room-card";
import { motion } from "framer-motion";
import { BackButton } from "@/components/back-button";

export default function Recommendations() {
  const { userId, isVerified, user } = useAuth();
  
  // Simulated geolocation for nearby suggestions
  const mockLat = 27.7172; 
  const mockLng = 85.3240; // Kathmandu coordinates

  const getRecommendationsMutation = useGetRecommendations();

  useEffect(() => {
    if (isVerified && userId) {
      getRecommendationsMutation.mutate({
        data: {
          userId,
          latitude: mockLat,
          longitude: mockLng,
          limit: 10
        }
      });
    }
  }, [isVerified, userId]);

  // Check if user is logged in
  if (!user) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
        <BackButton fallback="/" label="Back" className="mb-6 text-left" />
        <div className="w-24 h-24 bg-gradient-to-br from-muted to-muted/50 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Lock className="text-muted-foreground" size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-3">Sign In Required</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          You must sign in to access AI-powered recommendations.
        </p>
        <Link href="/login">
          <Button size="lg" className="w-full rounded-xl bg-primary shadow-lg shadow-primary/25">
            Sign In to View Recommendations
          </Button>
        </Link>
      </div>
    );
  }

  // Check if user is verified
  if (!isVerified) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
        <BackButton fallback="/" label="Back" className="mb-6 text-left" />
        <div className="w-24 h-24 bg-gradient-to-br from-muted to-muted/50 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Lock className="text-muted-foreground" size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-3">Verify Your Identity</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          AI-powered recommendations are only available to verified users. Verify your identity to get personalized room suggestions.
        </p>
        <Link href="/verification">
          <Button size="lg" className="w-full rounded-xl bg-primary shadow-lg shadow-primary/25">
            Verify Identity to Unlock Recommendations
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-10 min-h-screen">

      {/* Mobile Back Button */}
      <div className="px-4 pt-4">
        <BackButton fallback="/" label="Back" className="" />
      </div>

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 md:p-12 mb-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-20 transform translate-x-10 -translate-y-10">
          <Compass size={250} />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Sparkles size={16} className="text-yellow-300" /> AI Powered Matchmaking
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Made Just For You</h1>
          <p className="text-indigo-100 text-lg max-w-xl">
            We analyze your saved rooms, location, and preferences to find the perfect match using collaborative filtering and spatial analysis.
          </p>
        </div>
      </div>

      {getRecommendationsMutation.isPending ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-2xl h-[340px] animate-pulse border border-border" />
          ))}
        </div>
      ) : getRecommendationsMutation.isSuccess && getRecommendationsMutation.data.results.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {getRecommendationsMutation.data.results.map((result, i) => (
            <motion.div
              key={result.roomId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <RoomCard 
                room={result.room} 
                recommendationScore={result.finalScore}
                recommendationTag={result.tag}
              />
              <div className="mt-2 text-xs text-muted-foreground px-2 flex justify-between">
                <span>📍 {result.distanceKm.toFixed(1)} km from your search</span>
                <span>{result.reason || "High match score"}</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-border shadow-sm">
          <Sparkles size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-foreground">Building your profile</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Interact with more rooms (save, view) to get personalized AI recommendations here.
          </p>
        </div>
      )}
    </div>
  );
}
