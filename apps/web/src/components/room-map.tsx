import { useEffect, useState, useRef } from "react";
import { MapPin, Navigation, ExternalLink } from "lucide-react";

interface RoomMapProps {
  roomLat: number;
  roomLng: number;
  roomTitle: string;
  roomAddress: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildMapsUrl(userLoc: { lat: number; lng: number } | null, roomLat: number, roomLng: number): string {
  const dest = `${roomLat},${roomLng}`;
  if (userLoc) {
    return `https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${dest}&travelmode=driving`;
  }
  // No user location yet — Google Maps will ask for current location automatically
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

export function RoomMap({ roomLat, roomLng, roomTitle, roomAddress }: RoomMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [locStatus, setLocStatus] = useState<"pending" | "granted" | "denied">("pending");
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) { setLocStatus("denied"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(loc);
        setDistanceKm(haversineKm(loc.lat, loc.lng, roomLat, roomLng));
        setLocStatus("granted");
      },
      () => setLocStatus("denied"),
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [roomLat, roomLng]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet")
      .then(L => {
        return import("leaflet/dist/leaflet.css").then(() => L);
      })
      .then(L => {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: false });
        mapInstanceRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        const roomIcon = L.divIcon({
          html: `<div style="background:#DC143C;color:white;border-radius:50% 50% 50% 0;width:34px;height:34px;display:flex;align-items:center;justify-content:center;transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35)"><span style="transform:rotate(45deg);font-size:15px">🏠</span></div>`,
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 34],
        });

        L.marker([roomLat, roomLng], { icon: roomIcon })
          .addTo(map)
          .bindPopup(`<strong>${roomTitle}</strong><br/><span style="color:#666;font-size:12px">${roomAddress}</span>`, { maxWidth: 220 })
          .openPopup();

        map.setView([roomLat, roomLng], 15);
        (map as any)._leafletL = L;
      })
      .catch(err => {
        console.error("Leaflet map failed to load", err);
        setMapError("Unable to load map right now.");
      });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [roomLat, roomLng, roomTitle, roomAddress]);

  useEffect(() => {
    if (!userLoc || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const L = map._leafletL;
    if (!L) return;

    const userIcon = L.divIcon({
      html: `<div style="background:#003893;color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-size:13px">📍</div>`,
      className: "",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    L.marker([userLoc.lat, userLoc.lng], { icon: userIcon })
      .addTo(map)
      .bindPopup("<strong>Your Location</strong>", { maxWidth: 150 });

    L.polyline(
      [[userLoc.lat, userLoc.lng], [roomLat, roomLng]],
      { color: "#DC143C", weight: 2.5, dashArray: "8 6", opacity: 0.75 }
    ).addTo(map);

    const bounds = L.latLngBounds([userLoc.lat, userLoc.lng], [roomLat, roomLng]);
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [userLoc, roomLat, roomLng]);

  const mapsUrl = buildMapsUrl(userLoc, roomLat, roomLng);

  return (
    <div className="space-y-3">
      {/* Legend + distance */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-primary shrink-0" />
          <span className="text-muted-foreground">Room</span>
        </div>
        {locStatus === "granted" && userLoc && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-secondary shrink-0" />
            <span className="text-muted-foreground">Your location</span>
          </div>
        )}
        {distanceKm !== null && (
          <div className="ml-auto flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">
            <Navigation size={13} />
            {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(1)} km away`}
          </div>
        )}
        {locStatus === "pending" && (
          <span className="text-xs text-muted-foreground ml-auto animate-pulse">Detecting your location…</span>
        )}
        {locStatus === "denied" && (
          <span className="text-xs text-muted-foreground ml-auto">Enable location for distance & directions</span>
        )}
      </div>

      {/* Map */}
      {mapError ? (
        <div className="w-full rounded-2xl border border-border bg-slate-50 p-6 text-center text-sm text-muted-foreground">
          {mapError}
        </div>
      ) : (
        <div
          ref={mapRef}
          className="w-full rounded-2xl overflow-hidden border border-border shadow-sm"
          style={{ height: 320 }}
        />
      )}

      {/* Google Maps CTA */}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm bg-primary/5 hover:bg-primary/10 text-primary font-semibold px-4 py-2.5 rounded-xl transition-colors border border-primary/20"
      >
        <ExternalLink size={14} />
        {locStatus === "granted"
          ? "Open turn-by-turn directions in Google Maps"
          : "Open in Google Maps (will use your current location)"}
      </a>
    </div>
  );
}
