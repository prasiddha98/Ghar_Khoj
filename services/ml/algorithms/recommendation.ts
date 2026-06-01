export interface Room {
  id: number;
  latitude: number;
  longitude: number;
  parking: boolean;
  isAvailable: boolean;
  roomType: string;
  tenantType?: string | null;
  city?: string | null;
  price: number;
  [key: string]: unknown;
}

export interface Interaction {
  userId: number;
  roomId: number;
  type: string;
}

export interface User {
  id: number;
}

export interface TenantPreference {
  city?: string | null;
  roomType?: string | null;
  tenantType?: string | null;
  minBudget?: number | null;
  maxBudget?: number | null;
  parking?: boolean | null;
}

export interface RoomFilters {
  city?: string;
  roomType?: string;
  tenantType?: string;
  parking?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface RecommendationResult {
  roomId: number;
  room: Room;
  distanceKm: number;
  contentScore: number;
  amenityScore: number;
  typeScore: number;
  knnScore: number;
  collabScore: number;
  preferenceScore: number;
  finalScore: number;
  tag: string;
  reason?: string;
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateDistanceScore(distanceKm: number): number {
  return Math.max(0, 1 - distanceKm / 50);
}

export function calculateAmenityPreferenceScore(
  room: Room,
  allRooms: Room[],
  viewedRoomIds: number[]
): number {
  if (viewedRoomIds.length === 0) {
    return 0.5; // Neutral if no history
  }
  const viewedRooms = getViewedRoomsWithDuplicates(viewedRoomIds, allRooms);

  // Calculate what percentage of viewed rooms had parking
  const parkingCount = viewedRooms.filter((r) => r.parking).length;
  const userParkingPreference = parkingCount / viewedRoomIds.length;

  // Calculate what percentage of viewed rooms were available
  const availableCount = viewedRooms.filter((r) => r.isAvailable).length;
  const userAvailabilityPreference = availableCount / viewedRoomIds.length;

  // Score based on amenities matching user's viewed preferences
  let score = 0;

  // Parking score: if user viewed rooms with parking, boost parking rooms
  if (room.parking && userParkingPreference >= 0.3) {
    // If user viewed 30%+ rooms with parking, prioritize parking rooms
    score += userParkingPreference * 0.6; // Up to 0.6 points for parking match
  } else if (!room.parking && userParkingPreference >= 0.3) {
    // Penalize rooms without parking if user preferred parking
    score -= userParkingPreference * 0.2; // Down to -0.2 for no parking when user wants it
  }

  // Availability score: rooms that are available score higher
  if (room.isAvailable && userAvailabilityPreference >= 0.4) {
    score += userAvailabilityPreference * 0.4; // Up to 0.4 for availability match
  }

  return Math.max(0, Math.min(1, score + 0.5)); // Normalize to 0-1, default to 0.5
}

export function calculateContentScore(
  room: Room,
  allRooms: Room[],
  viewedRoomIds: number[]
): number {
  const availabilityScore = room.isAvailable ? 0.5 : 0;
  const parkingScore = room.parking ? 0.3 : 0;

  if (viewedRoomIds.length === 0) {
    return Math.min(1, availabilityScore + parkingScore + 0.2);
  }

  const viewedRooms = getViewedRoomsWithDuplicates(viewedRoomIds, allRooms);
  const parkingPreferenceCount = viewedRooms.filter((r) => r.parking).length;
  const availabilityPreferenceCount = viewedRooms.filter((r) => r.isAvailable).length;

  const userLikesParking = parkingPreferenceCount / viewedRoomIds.length;
  const userLikesAvailable = availabilityPreferenceCount / viewedRoomIds.length;

  const adjustedParkingScore = room.parking ? 0.3 + userLikesParking * 0.2 : 0;
  const adjustedAvailableScore = room.isAvailable ? 0.5 + userLikesAvailable * 0.2 : 0;

  return Math.min(1, adjustedAvailableScore + adjustedParkingScore);
}

export function calculatePreferenceMatchScore(
  room: Room,
  tenantPref?: TenantPreference | null
): number {
  if (!tenantPref) {
    return 0.5; // Neutral score if no preferences
  }

  let matchScore = 0;
  let totalFactors = 0;

  // Room type preference
  if (tenantPref.roomType) {
    totalFactors++;
    if (room.roomType === tenantPref.roomType) {
      matchScore += 1;
    }
  }

  // Tenant type preference
  if (tenantPref.tenantType) {
    totalFactors++;
    if (room.tenantType === tenantPref.tenantType) {
      matchScore += 1;
    }
  }

  // Price range preference
  if (tenantPref.minBudget !== null && tenantPref.minBudget !== undefined) {
    totalFactors++;
    if (room.price >= tenantPref.minBudget) {
      matchScore += 0.5;
    }
  }

  if (tenantPref.maxBudget !== null && tenantPref.maxBudget !== undefined) {
    totalFactors++;
    if (room.price <= tenantPref.maxBudget) {
      matchScore += 0.5;
    }
  }

  // Parking preference
  if (tenantPref.parking !== null && tenantPref.parking !== undefined) {
    totalFactors++;
    if (room.parking === tenantPref.parking) {
      matchScore += 1;
    }
  }

  // Return normalized score (0-1)
  return totalFactors > 0 ? Math.min(1, matchScore / totalFactors) : 0.5;
}

export function getDominantRoomType(
  allRooms: Room[],
  viewedRoomIds: number[]
): string | null {
  if (viewedRoomIds.length < 3) {
    return null;
  }
  // Count room types based on view occurrences (duplicates count)
  const roomTypeCount = getRoomTypeCountsFromViewed(viewedRoomIds, allRooms);

  // Find the most viewed room type (requires at least 3 views)
  let dominantType: string | null = null;
  let maxCount = 0;

  Object.entries(roomTypeCount).forEach(([type, count]) => {
    if (count >= 3 && count > maxCount) {
      dominantType = type;
      maxCount = count;
    }
  });

  return dominantType;
}

export function calculateRoomTypePreferenceScore(
  room: Room,
  allRooms: Room[],
  viewedRoomIds: number[]
): number {
  if (viewedRoomIds.length === 0) {
    return 0;
  }
  // Count room types using view occurrences (duplicates count)
  const roomTypeCount = getRoomTypeCountsFromViewed(viewedRoomIds, allRooms);

  if (roomTypeCount[room.roomType]) {
    const preference = Math.min(1, roomTypeCount[room.roomType] / viewedRoomIds.length);
    return preference;
  }

  return 0;
}

export function calculateKnnScore(
  room: Room,
  allRooms: Room[],
  viewedRoomIds: number[]
): number {
  if (viewedRoomIds.length === 0) {
    return 0.1;
  }

  // Count viewed rooms with duplicates (each view counts)
  const roomMap: Record<number, Room> = {};
  allRooms.forEach((r) => (roomMap[r.id] = r));
  const viewedRoomsWithDuplicates = viewedRoomIds.map((id) => roomMap[id]).filter(Boolean as any) as Room[];

  const similarRooms = viewedRoomsWithDuplicates.filter((r) => {
    const rType = getEffectiveRoomType(r);
    const thisType = getEffectiveRoomType(room);
    return rType && thisType && rType === thisType && Math.abs((r.price as number) - room.price) < room.price * 0.3;
  });

  return Math.min(1, (similarRooms.length / Math.max(viewedRoomIds.length, 1)) * 0.5);
}

export function calculateCollaborativeScore(
  room: Room,
  users: User[],
  interactions: Interaction[],
  currentUserId: number
): number {
  if (users.length <= 1) {
    return 0.05;
  }

  const userRoomSet = new Set(
    interactions.filter((i) => i.userId === currentUserId).map((i) => i.roomId)
  );

  let similaritySum = 0;
  let similarUsersCount = 0;

  for (const otherUser of users) {
    if (otherUser.id === currentUserId) {
      continue;
    }

    const otherRoomSet = new Set(
      interactions.filter((i) => i.userId === otherUser.id).map((i) => i.roomId)
    );

    if (otherRoomSet.size === 0) {
      continue;
    }

    const intersection = new Set([...userRoomSet].filter((roomId) => otherRoomSet.has(roomId)));
    const union = new Set([...userRoomSet, ...otherRoomSet]);

    if (union.size > 0 && otherRoomSet.has(room.id)) {
      const jaccardSimilarity = intersection.size / union.size;
      similaritySum += jaccardSimilarity;
      similarUsersCount++;
    }
  }

  return similarUsersCount > 0
    ? Math.min(1, similaritySum / Math.max(similarUsersCount, 1))
    : 0.05;
}

// Helper: return viewed rooms preserving duplicates (so repeated views count)
function getViewedRoomsWithDuplicates(viewedRoomIds: number[], allRooms: Room[]): Room[] {
  const roomMap: Record<number, Room> = {};
  allRooms.forEach((r) => (roomMap[r.id] = r));
  return viewedRoomIds.map((id) => roomMap[id]).filter(Boolean as any) as Room[];
}

// Helper: get counts of room types from viewed room ids (counts duplicates)
function getRoomTypeCountsFromViewed(viewedRoomIds: number[], allRooms: Room[]): Record<string, number> {
  const viewed = getViewedRoomsWithDuplicates(viewedRoomIds, allRooms);
  const roomTypeCount: Record<string, number> = {};
  viewed.forEach((r) => {
    if (!r) return;
    const t = getEffectiveRoomType(r);
    if (!t) return;
    roomTypeCount[t] = (roomTypeCount[t] || 0) + 1;
  });
  return roomTypeCount;
}

// Infer room type from textual fields when `roomType` is missing or unreliable
export function inferRoomTypeFromText(room: Room): string | null {
  const textFields: string[] = [];
  const t = (room as any).title;
  const d = (room as any).description || (room as any).details || (room as any).summary;
  if (typeof t === "string") textFields.push(t.toLowerCase());
  if (typeof d === "string") textFields.push(d.toLowerCase());

  const combined = textFields.join(" ");
  if (!combined) return null;

  if (/\b(single|1bhk|one bhk|one-room|one room|single room|studio)\b/.test(combined)) return "single";
  if (/\b(double|2bhk|two bhk|two-room|two room|double room)\b/.test(combined)) return "double";
  if (/\b(flat|apartment|apartment for rent|residential)\b/.test(combined)) return "flat";
  if (/\b(shared|sharing|roommate)\b/.test(combined)) return "shared";
  if (/\b(hostel)\b/.test(combined)) return "hostel";
  if (/\b(studio)\b/.test(combined)) return "studio";

  return null;
}

export function getEffectiveRoomType(room: Room): string | null {
  if (room.roomType && typeof room.roomType === "string" && room.roomType.trim() !== "") {
    return room.roomType;
  }
  const inferred = inferRoomTypeFromText(room);
  return inferred;
}

export function matchesTenantPreferences(
  room: Room,
  tenantPref?: TenantPreference | null,
  preferredCity?: string | null
): boolean {
  const effectiveCity = tenantPref?.city || preferredCity;

  if (!tenantPref && !effectiveCity) {
    return true;
  }

  if (effectiveCity && room.city !== effectiveCity) {
    return false;
  }
  if (tenantPref?.roomType && room.roomType !== tenantPref.roomType) {
    return false;
  }
  if (tenantPref?.tenantType && room.tenantType !== tenantPref.tenantType) {
    return false;
  }
  if (tenantPref?.minBudget !== null && tenantPref?.minBudget !== undefined && room.price < tenantPref.minBudget) {
    return false;
  }
  if (tenantPref?.maxBudget !== null && tenantPref?.maxBudget !== undefined && room.price > tenantPref.maxBudget) {
    return false;
  }

  return true;
}

export function matchesRoomFilters(room: Room, filters?: RoomFilters | null): boolean {
  if (!filters) {
    return true;
  }

  if (filters.city && room.city !== filters.city) {
    return false;
  }
  if (filters.roomType && room.roomType !== filters.roomType) {
    return false;
  }
  if (filters.tenantType && room.tenantType !== filters.tenantType) {
    return false;
  }
  if (filters.parking !== undefined && room.parking !== filters.parking) {
    return false;
  }
  if (filters.minPrice !== undefined && room.price < filters.minPrice) {
    return false;
  }
  if (filters.maxPrice !== undefined && room.price > filters.maxPrice) {
    return false;
  }

  return true;
}

export function buildRecommendationResults(options: {
  rooms: Room[];
  users: User[];
  interactions: Interaction[];
  tenantPref?: TenantPreference | null;
  userPreferredCity?: string | null;
  filters?: RoomFilters | null;
  latitude: number;
  longitude: number;
  userId: number;
  limit?: number;
}): RecommendationResult[] {
  const {
    rooms,
    users,
    interactions,
    tenantPref,
    userPreferredCity,
    filters,
    latitude,
    longitude,
    userId,
    limit = 10,
  } = options;

  const viewedRoomIds = interactions
    .filter((i) => i.userId === userId && i.type === "view")
    .map((i) => i.roomId);

  const viewedRoomsWithDuplicates = getViewedRoomsWithDuplicates(viewedRoomIds, rooms);

  // Detect if user has a strong preference for a specific room type
  const dominantRoomType = getDominantRoomType(rooms, viewedRoomIds);

  const scored = rooms.map((room) => {
    if (!matchesTenantPreferences(room, tenantPref, userPreferredCity) || !matchesRoomFilters(room, filters)) {
      return {
        roomId: room.id,
        room,
        distanceKm: 0,
        contentScore: 0,
        amenityScore: 0,
        typeScore: 0,
        knnScore: 0,
        collabScore: 0,
        preferenceScore: 0,
        finalScore: Number.NEGATIVE_INFINITY,
        tag: "Filtered",
        reason: "Does not match tenant preferences or filters",
      };
    }

    const distanceKm = room.latitude && room.longitude
      ? haversineDistance(latitude, longitude, room.latitude, room.longitude)
      : 0;
    const distanceScore = calculateDistanceScore(distanceKm);
    const contentScore = calculateContentScore(room, rooms, viewedRoomIds);
    const amenityScore = calculateAmenityPreferenceScore(room, rooms, viewedRoomIds);
    const typeScore = calculateRoomTypePreferenceScore(room, rooms, viewedRoomIds);
    const preferenceScore = calculatePreferenceMatchScore(room, tenantPref);
    const knnScore = calculateKnnScore(room, rooms, viewedRoomIds);
    const collabScore = calculateCollaborativeScore(room, users, interactions, userId);

    const effectiveRoomType = getEffectiveRoomType(room);
    const matchingDominantType = dominantRoomType && effectiveRoomType === dominantRoomType;

    const typePriority = matchingDominantType ? 1 : 0;
    const preferredParking = viewedRoomsWithDuplicates.filter((r) => r.parking).length / Math.max(viewedRoomIds.length, 1);
    const parkingBonus = room.parking && preferredParking >= 0.3 ? 0.1 : 0;

    const prioritizedScore =
      distanceScore * 0.45 +
      contentScore * 0.35 +
      amenityScore * 0.1 +
      knnScore * 0.1 +
      collabScore * 0.05 +
      parkingBonus;

    const finalScore = Math.min(1, Math.max(0, prioritizedScore + typeScore * 0.05 + preferenceScore * 0.05 + typePriority * 0.15));

    return {
      roomId: room.id,
      room,
      distanceKm,
      contentScore,
      amenityScore,
      typeScore,
      knnScore,
      collabScore,
      preferenceScore,
      finalScore,
      tag: "Recommended",
      reason: room.isAvailable ? "Available now" : "Good match",
    };
  });

  return scored
    .filter((result) => result.finalScore > Number.NEGATIVE_INFINITY)
    .sort((left, right) => {
      const leftDominant = dominantRoomType && getEffectiveRoomType(left.room) === dominantRoomType ? 1 : 0;
      const rightDominant = dominantRoomType && getEffectiveRoomType(right.room) === dominantRoomType ? 1 : 0;
      if (leftDominant !== rightDominant) {
        return rightDominant - leftDominant;
      }

      const leftDistanceScore = calculateDistanceScore(left.distanceKm);
      const rightDistanceScore = calculateDistanceScore(right.distanceKm);
      if (leftDistanceScore !== rightDistanceScore) {
        return rightDistanceScore - leftDistanceScore;
      }

      if (left.contentScore !== right.contentScore) {
        return right.contentScore - left.contentScore;
      }

      if (left.room.parking !== right.room.parking) {
        return right.room.parking ? 1 : -1;
      }

      if (left.knnScore !== right.knnScore) {
        return right.knnScore - left.knnScore;
      }

      if (left.collabScore !== right.collabScore) {
        return right.collabScore - left.collabScore;
      }

      return right.finalScore - left.finalScore;
    })
    .slice(0, limit);
}
