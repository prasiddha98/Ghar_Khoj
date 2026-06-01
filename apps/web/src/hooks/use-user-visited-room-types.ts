import { useAuth } from "./use-auth";
import { useEffect, useState } from "react";

/**
 * Hook to fetch user's visited room types
 * Returns the most common room types the user has viewed
 * 
 * Note: Currently returns empty array as backend doesn't provide room data
 * with interactions. This is a placeholder for future implementation.
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
        
        // For now, we return empty array to allow sorting to work
        // TODO: Backend should be updated to include room data with interactions
        // or provide a separate endpoint to get room details by room IDs
        
        setVisitedRoomTypes([]);
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
