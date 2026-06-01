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
          console.log("No interactions found");
          setVisitedRoomTypes([]);
          return;
        }

        console.log("Fetched interactions:", interactions);

        // Step 2: Extract unique room IDs
        const roomIds = [...new Set(interactions.map((i: any) => i.roomId))];
        console.log("Room IDs to fetch:", roomIds);

        // Step 3: Fetch room details for each room ID in parallel
        const roomFetchPromises = roomIds.map(roomId =>
          fetch(`/api/rooms/${roomId}`)
            .then(res => res.json())
            .then(data => data.room || data)
            .catch(err => {
              console.error(`Failed to fetch room ${roomId}:`, err);
              return null;
            })
        );

        const rooms = await Promise.all(roomFetchPromises);
        console.log("Fetched rooms:", rooms);

        // Step 4: Count room types from the fetched room data
        const roomTypeMap = new Map<string, number>();

        rooms.forEach(room => {
          if (room && room.roomType) {
            const roomType = room.roomType;
            roomTypeMap.set(roomType, (roomTypeMap.get(roomType) || 0) + 1);
          }
        });

        // Step 5: Sort by frequency and get room types
        const sortedRoomTypes = Array.from(roomTypeMap.entries())
          .sort(([, countA], [, countB]) => countB - countA)
          .map(([roomType]) => roomType);

        console.log("Visited room types (sorted by frequency):", sortedRoomTypes);
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
