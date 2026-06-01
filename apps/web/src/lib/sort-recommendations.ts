import { RecommendationResult } from "@workspace/api-client-react";

/**
 * Sort recommendations based on priority:
 * 1. Room type match (same as visited types first)
 * 2. Distance (closer first, ascending)
 * 3. Content score (higher first, descending)
 * 4. KNN score (higher first, descending)
 * 5. Collaborative score (higher first, descending)
 */
export function sortRecommendations(
  recommendations: RecommendationResult[],
  visitedRoomTypes: string[]
): RecommendationResult[] {
  return [...recommendations].sort((a, b) => {
    // 1. Room type match - visited types first
    const aIsMatchedType = visitedRoomTypes.includes(a.room.roomType);
    const bIsMatchedType = visitedRoomTypes.includes(b.room.roomType);

    if (aIsMatchedType && !bIsMatchedType) return -1;
    if (!aIsMatchedType && bIsMatchedType) return 1;

    // If both or neither are matched types, compare by position in visited list
    if (aIsMatchedType && bIsMatchedType) {
      const aTypeIndex = visitedRoomTypes.indexOf(a.room.roomType);
      const bTypeIndex = visitedRoomTypes.indexOf(b.room.roomType);
      if (aTypeIndex !== bTypeIndex) return aTypeIndex - bTypeIndex;
    }

    // 2. Distance - closer first (ascending)
    const aDistance = a.distanceKm || Number.MAX_VALUE;
    const bDistance = b.distanceKm || Number.MAX_VALUE;
    if (aDistance !== bDistance) return aDistance - bDistance;

    // 3. Content score - higher first (descending)
    const aContentScore = a.contentScore || 0;
    const bContentScore = b.contentScore || 0;
    if (aContentScore !== bContentScore) return bContentScore - aContentScore;

    // 4. KNN score - higher first (descending)
    const aKnnScore = a.knnScore || 0;
    const bKnnScore = b.knnScore || 0;
    if (aKnnScore !== bKnnScore) return bKnnScore - aKnnScore;

    // 5. Collaborative score - higher first (descending)
    const aCollabScore = a.collabScore || 0;
    const bCollabScore = b.collabScore || 0;
    if (aCollabScore !== bCollabScore) return bCollabScore - aCollabScore;

    // If all equal, maintain original order
    return 0;
  });
}
