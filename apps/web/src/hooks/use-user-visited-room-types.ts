import { useAuth } from "./use-auth";
import { useEffect, useState } from "react";
import { useGetRoom } from "@workspace/api-client-react";

/**
 * Hook to fetch user's visited room types
 * Prioritizes room types the user has viewed 2-3+ times
 * 
 * Algorithm:
 * 1. Fetch user's view interactions to get room IDs
 * 2. Fetch room data for those IDs to extract roomType
 * 3. Count frequency: rooms visited 2-3+ times considered priority
 * 4. Return room types sorted by visit frequency (most visited first)
 * 
 * Result: Home page shows user's most-visited room types first,
 * then sorts by distance and parking within those types
 */
export function useUserVisitedRoomTypes() {
  const { userId } = useAuth();
  const [visitedRoomTypes, setVisitedRoomTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [roomIds, setRoomIds] = useState<number[]>([]);

  // Step 1: Fetch interactions to get room IDs
  useEffect(() => {
    if (!userId) return;

    const fetchInteractions = async () => {
      try {
        setIsLoading(true);
        
        const response = await fetch(`/api/interactions/user/${userId}?type=view`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.error("Failed to fetch interactions:", response.status);
          setRoomIds([]);
          return;
        }

        const data = await response.json();
        const interactions = data.interactions || [];
        
        // Extract unique room IDs, sorted by most recent first
        const ids = Array.from(
          new Map(
            interactions
              .sort((a: any, b: any) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              .map((i: any) => [i.roomId, i])
          ).values()
        ).map((i: any) => i.roomId);

        console.log("Extracted room IDs from interactions:", ids);
        setRoomIds(ids);
      } catch (error) {
        console.error("Error fetching interactions:", error);
        setRoomIds([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInteractions();
  }, [userId]);

  // Step 2: Fetch room details in batches using React Query
  useEffect(() => {
    if (!roomIds.length) {
      setVisitedRoomTypes([]);
      return;
    }

    const fetchRoomTypesFromIds = async () => {
      try {
        const roomTypeCount = new Map<string, number>();

        // Fetch room details for each room ID
        // Limit to first 20 to avoid too many API calls
        const limitedIds = roomIds.slice(0, 20);
        
        for (const roomId of limitedIds) {
          try {
            const res = await fetch(`/api/rooms/${roomId}`);
            if (!res.ok) continue;
            
            const data = await res.json();
            const room = data.room || data;
            
            if (room?.roomType) {
              roomTypeCount.set(room.roomType, (roomTypeCount.get(room.roomType) || 0) + 1);
            }
          } catch (err) {
            console.error(`Failed to fetch room ${roomId}:`, err);
            continue;
          }
        }

        // Sort by frequency: rooms visited 2-3+ times get priority
        const sorted = Array.from(roomTypeCount.entries())
          .sort(([, countA], [, countB]) => countB - countA)
          .map(([roomType, count]) => roomType);

        console.log("Room types by frequency:", Object.fromEntries(roomTypeCount));
        console.log("Sorted room types:", sorted);
        
        setVisitedRoomTypes(sorted);
      } catch (error) {
        console.error("Error fetching room types:", error);
        setVisitedRoomTypes([]);
      }
    };

    fetchRoomTypesFromIds();
  }, [roomIds]);

  return { visitedRoomTypes, isLoading };
}
