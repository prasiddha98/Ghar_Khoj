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

export function calculateContentScore(
  room: Room,
  allRooms: Room[],
  viewedRoomIds: number[]
): number {
  // Base score for availability (critical amenity)
  const availabilityScore = room.isAvailable ? 0.5 : 0;
  
  // If user has viewed rooms, match amenities they showed interest in
  if (viewedRoomIds.length === 0) {
    // No history: default scoring
    return availabilityScore + (room.parking ? 0.2 : 0) + 0.3;
  }

  // Analyze what amenities user preferred based on viewed rooms
  const viewedRooms = allRooms.filter((r) => viewedRoomIds.includes(r.id));
  const parkingPreferenceCount = viewedRooms.filter((r) => r.parking).length;
  const availabilityPreferenceCount = viewedRooms.filter((r) => r.isAvailable).length;

  // User preference percentages
  const userLikesParking = parkingPreferenceCount / viewedRoomIds.length;
  const userLikesAvailable = availabilityPreferenceCount / viewedRoomIds.length;

  // Score based on user's preferences
  const parkingScore = room.parking ? userLikesParking * 0.3 : 0;
  const availableScore = room.isAvailable ? userLikesAvailable * 0.7 : 0;

  return Math.min(1, availabilityScore + parkingScore + availableScore);
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

export function calculateRoomTypePreferenceScore(
  room: Room,
  allRooms: Room[],
  viewedRoomIds: number[]
): number {
  if (viewedRoomIds.length === 0) {
    return 0;
  }

  // Get all viewed rooms
  const viewedRooms = allRooms.filter((r) => viewedRoomIds.includes(r.id));
  
  // Count room types user has viewed
  const roomTypeCount: Record<string, number> = {};
  viewedRooms.forEach((r) => {
    roomTypeCount[r.roomType] = (roomTypeCount[r.roomType] || 0) + 1;
  });

  // If user viewed this room type, boost the score
  if (roomTypeCount[room.roomType]) {
    // Higher boost for more interactions with this type
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

  const similarRooms = allRooms.filter(
    (r) =>
      viewedRoomIds.includes(r.id) &&
      r.roomType === room.roomType &&
      Math.abs(r.price - room.price) < room.price * 0.3
  );

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
console.log("User preferred city:", userPreferredCity);
  const scored = rooms.map((room) => {
    if (!matchesTenantPreferences(room, tenantPref, userPreferredCity) || !matchesRoomFilters(room, filters)) {
      return {
        roomId: room.id,
        room,
        distanceKm: 0,
        contentScore: 0,
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
    const typeScore = calculateRoomTypePreferenceScore(room, rooms, viewedRoomIds);
    const preferenceScore = calculatePreferenceMatchScore(room, tenantPref);
    const knnScore = calculateKnnScore(room, rooms, viewedRoomIds);
    const collabScore = calculateCollaborativeScore(room, users, interactions, userId);

    // Combined scoring:
    // - Distance: 35% (haversine - closest rooms first)
    // - Type + Preference: 25% (what user viewed + their filter preferences)
    // - Content: 20% (amenities matching user history)
    // - KNN: 10% (similar price/type rooms)
    // - Collaborative: 10% (similar users' choices)
    const finalScore =
      distanceScore * 0.35 +
      (typeScore * 0.5 + preferenceScore * 0.5) * 0.25 +
      contentScore * 0.2 +
      knnScore * 0.1 +
      collabScore * 0.1;

    return {
      roomId: room.id,
      room,
      distanceKm,
      contentScore,
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
    .sort((left, right) => right.finalScore - left.finalScore)
    .slice(0, limit);
}
