import { useAuth } from "./use-auth";
import { useEffect, useState } from "react";

/**
 * Hook to fetch user's visited room types
 * Returns the most common room types the user has viewed
 */
export function useUserVisitedRoomTypes() {
  const { userId } = useAuth();
  const [visitedRoomTypes, setVisitedRoomTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchVisitedRoomTypes = async () => {
      try {
        setIsLoading(true);
        
        // Step 1: Fetch user interactions (view type)
        const interactionsResponse = await fetch(`/api/interactions/user/${userId}?type=view`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!interactionsResponse.ok) {
          console.error("Failed to fetch interactions:", interactionsResponse.status);
          setVisitedRoomTypes([]);
          return;
        }

        const interactionsData = await interactionsResponse.json();
        const interactions = interactionsData.interactions || [];

        if (!interactions.length) {
          setVisitedRoomTypes([]);
          return;
        }

        // Step 2: Extract unique room IDs from interactions
        const roomIds = [...new Set(interactions.map((i: any) => i.roomId))];

        // Step 3: Fetch room details for those rooms
        const roomsResponse = await fetch(`/api/rooms?ids=${roomIds.join(",")}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!roomsResponse.ok) {
          console.error("Failed to fetch rooms:", roomsResponse.status);
          setVisitedRoomTypes([]);
          return;
        }

        const roomsData = await roomsResponse.json();
        const rooms = roomsData.rooms || [];

        // Step 4: Create a map of roomId -> room for quick lookup
        const roomMap = new Map(rooms.map((r: any) => [r.id, r]));

        // Step 5: Count room types from interactions using room data
        const roomTypeMap = new Map<string, number>();

        for (const interaction of interactions) {
          const room = roomMap.get(interaction.roomId);
          if (room && room.roomType) {
            const roomType = room.roomType;
            roomTypeMap.set(roomType, (roomTypeMap.get(roomType) || 0) + 1);
          }
        }

        // Step 6: Sort by frequency and get room types
        const sortedRoomTypes = Array.from(roomTypeMap.entries())
          .sort(([, countA], [, countB]) => countB - countA)
          .map(([roomType]) => roomType);

        setVisitedRoomTypes(sortedRoomTypes);
      } catch (error) {
        console.error("Error fetching visited room types:", error);
        setVisitedRoomTypes([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisitedRoomTypes();
  }, [userId]);

  return { visitedRoomTypes, isLoading };
}
