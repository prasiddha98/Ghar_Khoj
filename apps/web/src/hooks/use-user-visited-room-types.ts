import { useAuth } from "./use-auth";
import { useEffect, useState } from "react";

/**
 * Hook to fetch user's visited room types
 * Returns the most common room type the user has viewed
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
        // Fetch user interactions (view type)
        const response = await fetch(`/api/interactions/user/${userId}?type=view`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.error("Failed to fetch interactions:", response.status);
          setVisitedRoomTypes([]);
          return;
        }

        const data = await response.json();
        const interactions = data.data || data || [];

        // Count room types from interactions
        const roomTypeMap = new Map<string, number>();

        for (const interaction of interactions) {
          if (interaction.room && interaction.room.roomType) {
            const roomType = interaction.room.roomType;
            roomTypeMap.set(roomType, (roomTypeMap.get(roomType) || 0) + 1);
          }
        }

        // Sort by frequency and get room types
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
