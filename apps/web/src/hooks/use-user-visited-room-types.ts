import { useAuth } from "./use-auth";
import { useEffect, useState } from "react";
import { useGetUserInteractions } from "@workspace/api-client-react";

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
  const [isLoadingRoomTypes, setIsLoadingRoomTypes] = useState(false);
  const [roomIds, setRoomIds] = useState<number[]>([]);

  const { data: interactionData, isLoading: interactionsLoading } = useGetUserInteractions(
    userId ?? 0,
    { type: "view" },
  );

  // Step 1: Use generated API hook to fetch user interactions with auth
  useEffect(() => {
    if (!userId || !interactionData?.interactions) {
      setRoomIds([]);
      return;
    }

    const interactions = interactionData.interactions;
    const ids = Array.from(
      new Map(
        interactions
          .sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .map((i: any) => [i.roomId, i]),
      ).values(),
    ).map((i: any) => i.roomId);

    console.log("Extracted room IDs from interactions:", ids);
    setRoomIds(ids);
  }, [userId, interactionData]);

  // Step 2: Fetch room details in batches using React Query
  useEffect(() => {
    if (!roomIds.length) {
      setVisitedRoomTypes([]);
      return;
    }

    const fetchRoomTypesFromIds = async () => {
      try {
        setIsLoadingRoomTypes(true);
        const roomTypeCount = new Map<string, number>();

        // Fetch room details for each room ID
        // Limit to first 20 to avoid too many API calls
        const limitedIds = roomIds.slice(0, 20);
        
        console.log("Fetching room details for IDs:", limitedIds);
        
        for (const roomId of limitedIds) {
          try {
            const res = await fetch(`/api/rooms/${roomId}`);
            
            if (!res.ok) {
              console.warn(`Room ${roomId} fetch returned status ${res.status}`);
              continue;
            }

            const contentType = res.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
              console.warn(`Room ${roomId} returned non-JSON content-type: ${contentType}`);
              continue;
            }
            
            const data = await res.json();
            const room = data.room || data;
            
            if (room?.roomType) {
              roomTypeCount.set(room.roomType, (roomTypeCount.get(room.roomType) || 0) + 1);
              console.log(`Room ${roomId} type: ${room.roomType}`);
            } else {
              console.warn(`Room ${roomId} has no roomType field:`, room);
            }
          } catch (err) {
            console.error(`Failed to fetch/parse room ${roomId}:`, err);
            continue;
          }
        }

        // Sort by frequency: rooms visited 2-3+ times get priority
        const sorted = Array.from(roomTypeCount.entries())
          .sort(([, countA], [, countB]) => countB - countA)
          .map(([roomType, count]) => roomType);

        console.log("Room types by frequency:", Object.fromEntries(roomTypeCount));
        console.log("Sorted room types (should show first in recommendations):", sorted);
        
        setVisitedRoomTypes(sorted);
      } catch (error) {
        console.error("Error fetching room types:", error);
        setVisitedRoomTypes([]);
      } finally {
        setIsLoadingRoomTypes(false);
      }
    };

    fetchRoomTypesFromIds();
  }, [roomIds]);

  return { visitedRoomTypes, isLoading: interactionsLoading || isLoadingRoomTypes };
}
