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
  createdAt?: string | Date;
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
  cityMatchScore: number;
  finalScore: number;
  tag: string;
  reason?: string;
}

// Recommendation algorithm pipeline:
// 1. Collect recent view interactions for the user.
// 2. Derive room-type preferences, parking, and availability signals.
// 3. Score each room on city match, distance, content, amenities, type affinity, and collaborative similarity.
// 4. Combine weighted scores and apply dominant-type / parking boosts.
// 5. Sort by city match first, then proximity, price, content, parking, similarity, and final score.
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
    return room.parking || room.isAvailable ? 0.6 : 0.4;
  }

  const { parkingRatio, availabilityRatio } = computeViewPreferences(viewedRoomIds, allRooms);
  const parkingSignal = room.parking ? Math.max(0, parkingRatio - 0.3) : Math.min(0, parkingRatio >= 0.3 ? -parkingRatio : 0);
  const parkingScore = parkingSignal * (room.parking ? 0.6 : 0.2);
  const availabilityScore = room.isAvailable ? availabilityRatio * 0.4 : 0;

  return Math.min(1, Math.max(0, 0.4 + parkingScore + availabilityScore));
}

export function calculateContentScore(
  room: Room,
  allRooms: Room[],
  viewedRoomIds: number[]
): number {
  const baseParking = room.parking ? 0.2 : 0;
  const baseAvailability = room.isAvailable ? 0.3 : 0;
  const typeSignal = getEffectiveRoomType(room);
  const { parkingRatio, availabilityRatio } = computeViewPreferences(viewedRoomIds, allRooms);

  const viewedTypeCounts = getRoomTypeCountsFromViewed(viewedRoomIds, allRooms);
  const typeAffinity = typeSignal ? (viewedTypeCounts[typeSignal] || 0) / Math.max(viewedRoomIds.length, 1) : 0;
  const fallbackScore = baseParking + baseAvailability + 0.15;

  return Math.min(1, viewedRoomIds.length === 0
    ? fallbackScore
    : baseParking + baseAvailability + typeAffinity * 0.3 + parkingRatio * 0.05 + availabilityRatio * 0.1);
}

export function calculatePreferenceMatchScore(
  room: Room,
  tenantPref?: TenantPreference | null,
  preferredCity?: string | null
): number {
  if (!tenantPref && !preferredCity) {
    return 0.5;
  }

  const cityMatch = preferredCity ? Number(room.city === preferredCity) : 0;
  const factors = [
    tenantPref?.city ? Number(room.city === tenantPref.city) : null,
    tenantPref?.roomType ? Number(room.roomType === tenantPref.roomType) : null,
    tenantPref?.tenantType ? Number(room.tenantType === tenantPref.tenantType) : null,
    tenantPref?.minBudget != null ? (room.price >= tenantPref.minBudget ? 0.5 : 0) : null,
    tenantPref?.maxBudget != null ? (room.price <= tenantPref.maxBudget ? 0.5 : 0) : null,
    tenantPref?.parking != null ? Number(room.parking === tenantPref.parking) : null,
  ].filter((value): value is number => value !== null);

  const matchScore = factors.length > 0
    ? Math.min(1, factors.reduce((sum, value) => sum + value, 0) / factors.length)
    : 0.5;

  return preferredCity ? Math.max(matchScore, cityMatch) : matchScore;
}

export function getDominantRoomType(
  allRooms: Room[],
  viewedRoomIds: number[]
): string | null {
  if (viewedRoomIds.length < 3) {
    return null;
  }

  const roomTypeCount = getRoomTypeCountsFromViewed(viewedRoomIds, allRooms);
  const effectiveTypes = getViewedRoomsWithDuplicates(viewedRoomIds, allRooms).map(getEffectiveRoomType);

  return Object.entries(roomTypeCount)
    .filter(([, count]) => count >= 3)
    .reduce<{ type: string | null; count: number; latestIndex: number }>(
      (winner, [type, count]) => {
        const lastIndex = effectiveTypes
          .map((t, index) => (t === type ? index : -1))
          .filter((index) => index >= 0)
          .pop() ?? -1;

        const shouldReplace =
          count > winner.count ||
          (count === winner.count && lastIndex > winner.latestIndex);

        return shouldReplace
          ? { type, count, latestIndex: lastIndex }
          : winner;
      },
      { type: null, count: 0, latestIndex: -1 }
    ).type;
}

export function calculateRoomTypePreferenceScore(
  room: Room,
  allRooms: Room[],
  viewedRoomIds: number[]
): number {
  if (viewedRoomIds.length === 0) {
    return 0;
  }

  const roomTypeCount = getRoomTypeCountsFromViewed(viewedRoomIds, allRooms);
  const effectiveType = getEffectiveRoomType(room);
  const count = effectiveType ? roomTypeCount[effectiveType] || 0 : 0;

  return Math.min(1, count / viewedRoomIds.length);
}

export function calculateKnnScore(
  _room: Room,
  _allRooms: Room[],
  _viewedRoomIds: number[]
): number {
  return 0;
}

export function calculateCollaborativeScore(
  room: Room,
  rooms: Room[],
  users: User[],
  interactions: Interaction[],
  currentUserId: number
): number {
  const roomMap = new Map(rooms.map((entry) => [entry.id, entry]));
  const currentRoomIds = new Set(
    interactions.filter((i) => i.userId === currentUserId).map((i) => i.roomId)
  );

  const similarities = users
    .filter((otherUser) => otherUser.id !== currentUserId)
    .map((otherUser) => {
      const otherRoomIds = interactions
        .filter((i) => i.userId === otherUser.id)
        .map((i) => i.roomId);
      if (otherRoomIds.length === 0) return 0;

      const otherRooms = otherRoomIds.map((id) => roomMap.get(id)).filter(Boolean) as Room[];
      const otherRoomSet = new Set(otherRoomIds);
      const sameRoom = otherRoomSet.has(room.id) ? 0.6 : 0;
      const sameType = otherRooms.some((item) => getEffectiveRoomType(item) === getEffectiveRoomType(room)) ? 0.25 : 0;
      const similarPrice = otherRooms.some((item) => Math.abs(item.price - room.price) <= Math.max(room.price * 0.3, 1000)) ? 0.15 : 0;
      const overlap = currentRoomIds.size > 0 ? otherRoomIds.filter((id) => currentRoomIds.has(id)).length / Math.max(currentRoomIds.size, 1) : 0;
      return Math.min(1, sameRoom + sameType + similarPrice + overlap * 0.2);
    })
    .filter((similarity) => similarity > 0);

  return similarities.length > 0
    ? Math.min(1, similarities.reduce((sum, value) => sum + value, 0) / similarities.length)
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
  return getViewedRoomsWithDuplicates(viewedRoomIds, allRooms).reduce<Record<string, number>>((counts, room) => {
    const type = getEffectiveRoomType(room);
    if (!type) return counts;
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
}

// Infer room type from textual fields when `roomType` is missing or unreliable
export function inferRoomTypeFromText(room: Room): string | null {
  const textFields: string[] = [];
  const title = (room as any).title;
  const description = (room as any).description || (room as any).details || (room as any).summary;
  if (typeof title === "string") textFields.push(title.toLowerCase());
  if (typeof description === "string") textFields.push(description.toLowerCase());

  const combined = textFields.join(" ");
  if (!combined) return null;

  const patterns: Array<{ type: string; regex: RegExp }> = [
    { type: "single", regex: /\b(single|1bhk|one bhk|one-room|one room|single room|studio)\b/ },
    { type: "double", regex: /\b(double|2bhk|two bhk|two-room|two room|double room)\b/ },
    { type: "flat", regex: /\b(flat|apartment|apartment for rent|residential)\b/ },
    { type: "shared", regex: /\b(shared|sharing|roommate)\b/ },
    { type: "hostel", regex: /\b(hostel)\b/ },
    { type: "studio", regex: /\b(studio)\b/ },
  ];

  return patterns.find((pattern) => pattern.regex.test(combined))?.type ?? null;
}

export function getEffectiveRoomType(room: Room): string | null {
  const normalizedRoomType =
    typeof room.roomType === "string" && room.roomType.trim() ? room.roomType : null;
  return normalizedRoomType ?? inferRoomTypeFromText(room);
}

const SCORE_WEIGHTS = {
  city: 0.3,
  distance: 0.25,
  content: 0.2,
  amenity: 0.1,
  collab: 0.15,
  typePriority: 0.1,
  preference: 0.1,
};

function toTimestamp(value?: string | Date): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return !isNaN(time) ? time : 0;
}

function getRecentViewInteractions(interactions: Interaction[], userId: number, limit = 10): Interaction[] {
  return interactions
    .filter((interaction) => interaction.userId === userId && interaction.type === "view")
    .slice()
    .sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt))
    .slice(-limit);
}

function computeViewPreferences(viewedRoomIds: number[], allRooms: Room[]) {
  const viewedRooms = getViewedRoomsWithDuplicates(viewedRoomIds, allRooms);
  const typeCount = getRoomTypeCountsFromViewed(viewedRoomIds, allRooms);
  const parkingCount = viewedRooms.filter((room) => room.parking).length;
  const availabilityCount = viewedRooms.filter((room) => room.isAvailable).length;

  return {
    viewedRooms,
    typeCount,
    parkingRatio: parkingCount / Math.max(viewedRoomIds.length, 1),
    availabilityRatio: availabilityCount / Math.max(viewedRoomIds.length, 1),
  };
}

function buildRoomScore(
  room: Room,
  rooms: Room[],
  viewedRoomIds: number[],
  tenantPref: TenantPreference | null | undefined,
  userPreferredCity: string | null | undefined,
  users: User[],
  interactions: Interaction[],
  userId: number,
  dominantRoomType: string | null,
  viewPreferences: ReturnType<typeof computeViewPreferences>,
  latitude: number,
  longitude: number
): RecommendationResult {
  const effectiveRoomType = getEffectiveRoomType(room);
  const distanceKm = room.latitude && room.longitude
    ? haversineDistance(latitude, longitude, room.latitude, room.longitude)
    : 0;

  const distanceScore = calculateDistanceScore(distanceKm);
  const contentScore = calculateContentScore(room, rooms, viewedRoomIds);
  const amenityScore = calculateAmenityPreferenceScore(room, rooms, viewedRoomIds);
  const typeScore = calculateRoomTypePreferenceScore(room, rooms, viewedRoomIds);
  const preferenceScore = calculatePreferenceMatchScore(room, tenantPref, tenantPref?.city || userPreferredCity || null);
  const knnScore = calculateKnnScore(room, rooms, viewedRoomIds);
  const collabScore = calculateCollaborativeScore(room, rooms, users, interactions, userId);
  const cityMatchScore = tenantPref?.city || userPreferredCity
    ? Number(room.city === (tenantPref?.city || userPreferredCity))
    : 0.5;

  const typePriority = dominantRoomType && effectiveRoomType === dominantRoomType ? 1 : 0;
  const parkingBonus = room.parking && viewPreferences.parkingRatio >= 0.3 ? 0.08 : 0;
  const cityBoost = room.city && (tenantPref?.city || userPreferredCity) && room.city === (tenantPref?.city || userPreferredCity) ? 0.1 : 0;

  const combined =
    cityMatchScore * SCORE_WEIGHTS.city +
    distanceScore * SCORE_WEIGHTS.distance +
    contentScore * SCORE_WEIGHTS.content +
    amenityScore * SCORE_WEIGHTS.amenity +
    collabScore * SCORE_WEIGHTS.collab +
    parkingBonus +
    cityBoost;

  const finalScore = Math.min(
    1,
    Math.max(
      0,
      combined + typeScore * SCORE_WEIGHTS.typePriority + preferenceScore * SCORE_WEIGHTS.preference
    )
  );

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
    cityMatchScore,
    finalScore,
    tag: "Recommended",
    reason: room.isAvailable ? "Available now" : "Good match",
  };
}

function compareRecommendationResults(left: RecommendationResult, right: RecommendationResult, dominantRoomType: string | null) {
  const compareKeys = [
    () => Number(getEffectiveRoomType(right.room) === dominantRoomType) - Number(getEffectiveRoomType(left.room) === dominantRoomType),
    () => right.cityMatchScore - left.cityMatchScore,
    () => calculateDistanceScore(right.distanceKm) - calculateDistanceScore(left.distanceKm),
    () => left.room.price - right.room.price,
    () => right.contentScore - left.contentScore,
    () => Number(right.room.parking) - Number(left.room.parking),
    () => right.collabScore - left.collabScore,
    () => right.finalScore - left.finalScore,
  ];

  return compareKeys.reduce((result, compare) => result !== 0 ? result : compare(), 0);
}

export function matchesTenantPreferences(
  room: Room,
  tenantPref?: TenantPreference | null,
  preferredCity?: string | null
): boolean {
  const effectiveCity = tenantPref?.city || preferredCity;
  const checks = [
    !effectiveCity || room.city === effectiveCity,
    !tenantPref?.roomType || room.roomType === tenantPref.roomType,
    !tenantPref?.tenantType || room.tenantType === tenantPref.tenantType,
    tenantPref?.minBudget == null || room.price >= tenantPref.minBudget,
    tenantPref?.maxBudget == null || room.price <= tenantPref.maxBudget,
    tenantPref?.parking == null || room.parking === tenantPref.parking,
  ];

  return checks.every(Boolean);
}

export function matchesRoomFilters(room: Room, filters?: RoomFilters | null): boolean {
  const checks = [
    !filters || !filters.city || room.city === filters.city,
    !filters || !filters.roomType || room.roomType === filters.roomType,
    !filters || !filters.tenantType || room.tenantType === filters.tenantType,
    !filters || filters.parking === undefined || room.parking === filters.parking,
    !filters || filters.minPrice === undefined || room.price >= filters.minPrice,
    !filters || filters.maxPrice === undefined || room.price <= filters.maxPrice,
  ];

  return checks.every(Boolean);
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

  const recentUserViews = getRecentViewInteractions(interactions, userId, 10);
  const viewedRoomIds = recentUserViews.map((interaction) => interaction.roomId);
  const viewPreferences = computeViewPreferences(viewedRoomIds, rooms);
  const dominantRoomType = getDominantRoomType(rooms, viewedRoomIds);

  return rooms
    .filter((room) => matchesTenantPreferences(room, tenantPref, userPreferredCity) && matchesRoomFilters(room, filters))
    .map((room) => buildRoomScore(room, rooms, viewedRoomIds, tenantPref, userPreferredCity, users, interactions, userId, dominantRoomType, viewPreferences, latitude, longitude))
    .sort((left, right) => compareRecommendationResults(left, right, dominantRoomType))
    .slice(0, limit);
}
