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
  knnScore: number;
  collabScore: number;
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

export function calculateContentScore(room: Room): number {
  return (room.parking ? 0.2 : 0) + (room.isAvailable ? 0.5 : 0) + 0.3;
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
  tenantPref?: TenantPreference | null
): boolean {
  if (!tenantPref) {
    return true;
  }

  if (tenantPref.city && room.city !== tenantPref.city) {
    return false;
  }
  if (tenantPref.roomType && room.roomType !== tenantPref.roomType) {
    return false;
  }
  if (tenantPref.tenantType && room.tenantType !== tenantPref.tenantType) {
    return false;
  }
  if (tenantPref.minBudget !== null && tenantPref.minBudget !== undefined && room.price < tenantPref.minBudget) {
    return false;
  }
  if (tenantPref.maxBudget !== null && tenantPref.maxBudget !== undefined && room.price > tenantPref.maxBudget) {
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
    filters,
    latitude,
    longitude,
    userId,
    limit = 10,
  } = options;

  const viewedRoomIds = interactions
    .filter((i) => i.userId === userId && i.type === "view")
    .map((i) => i.roomId);

  const scored = rooms.map((room) => {
    if (!matchesTenantPreferences(room, tenantPref) || !matchesRoomFilters(room, filters)) {
      return {
        roomId: room.id,
        room,
        distanceKm: 0,
        contentScore: 0,
        knnScore: 0,
        collabScore: 0,
        finalScore: Number.NEGATIVE_INFINITY,
        tag: "Filtered",
        reason: "Does not match tenant preferences or filters",
      };
    }

    const distanceKm = room.latitude && room.longitude
      ? haversineDistance(latitude, longitude, room.latitude, room.longitude)
      : 0;
    const distanceScore = calculateDistanceScore(distanceKm);
    const contentScore = calculateContentScore(room);
    const knnScore = calculateKnnScore(room, rooms, viewedRoomIds);
    const collabScore = calculateCollaborativeScore(room, users, interactions, userId);

    const finalScore =
      distanceScore * 0.25 +
      contentScore * 0.3 +
      knnScore * 0.25 +
      collabScore * 0.2 +
      (tenantPref?.parking === true && room.parking ? 0.2 : 0);

    return {
      roomId: room.id,
      room,
      distanceKm,
      contentScore,
      knnScore,
      collabScore,
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
