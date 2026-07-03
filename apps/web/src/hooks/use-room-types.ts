import { useCallback, useEffect, useState } from "react";
import { customFetch } from "@/lib/customFetch";

export interface RoomTypeOption {
  id: number;
  slug: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
}

export const DEFAULT_ROOM_TYPE_OPTIONS: Array<Pick<RoomTypeOption, "slug" | "label">> = [
  { slug: "single", label: "Single" },
  { slug: "1bhk", label: "1BHK" },
  { slug: "1bk", label: "1BK" },
  { slug: "double", label: "2BHK" },
  { slug: "flat", label: "3BHK" },
  { slug: "studio", label: "Studio" },
  { slug: "shared", label: "Shared" },
];

export function useRoomTypes(endpoint = "/room-types") {
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoomTypes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await customFetch<{ roomTypes: RoomTypeOption[] }>(endpoint);
      setRoomTypes(Array.isArray(data.roomTypes) ? data.roomTypes : []);
    } catch (err) {
      setRoomTypes([]);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to load room types.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchRoomTypes();
  }, [fetchRoomTypes]);

  return { roomTypes, isLoading, error, refetch: fetchRoomTypes };
}
