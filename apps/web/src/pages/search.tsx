import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search as SearchIcon, SlidersHorizontal, MapPin, X, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useGetRooms, RoomRoomType, RoomTenantType } from "@workspace/api-client-react";
import { RoomCard } from "@/components/room-card";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/back-button";

const POPULAR_CITIES = ["Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Biratnagar"];

export default function SearchPage() {
  const [location, setLocation] = useLocation();

  function getCityFromSearch() {
    const params = new URLSearchParams(window.location.search);
    return params.get("city") || "";
  }

  const [city, setCity] = useState(getCityFromSearch);
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [roomType, setRoomType] = useState<string>("");
  const [tenantType, setTenantType] = useState<string>("");
  const [parking, setParking] = useState(false);
  const [queryParams, setQueryParams] = useState<Record<string, unknown>>(() => {
    const c = getCityFromSearch();
    return c ? { city: c } : {};
  });

  // Sync when URL path changes (e.g. clicking a popular city from home page)
  useEffect(() => {
    const c = getCityFromSearch();
    setCity(c);
    setQueryParams(c ? { city: c } : {});
  }, [location]);

  const { data, isLoading } = useGetRooms(queryParams as any);

  const applyFilters = () => {
    const params: Record<string, unknown> = {};
    if (city.trim()) params.city = city.trim();
    if (minPrice) params.minPrice = Number(minPrice);
    if (maxPrice) params.maxPrice = Number(maxPrice);
    if (roomType) params.roomType = roomType;
    if (tenantType) params.tenantType = tenantType;
    if (parking) params.parking = true;
    setQueryParams(params);
    setShowFilters(false);
    const qs = city.trim() ? `?city=${encodeURIComponent(city.trim())}` : "";
    setLocation(`/search${qs}`);
  };

  const clearFilters = () => {
    setCity("");
    setMinPrice("");
    setMaxPrice("");
    setRoomType("");
    setTenantType("");
    setParking(false);
    setQueryParams({});
    setShowFilters(false);
    setLocation("/search");
  };

  const activeFilterCount = [city, minPrice, maxPrice, roomType, tenantType, parking].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6 pb-10 min-h-screen">

      {/* Mobile Back Button */}
      <div>
        <BackButton fallback="/" label="Back" className="" />
      </div>

      {/* Search bar */}
      <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-border flex flex-col md:flex-row gap-3 items-center sticky top-[72px] z-40">
        <div className="relative flex-1 w-full">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
          <Input
            value={city}
            onChange={e => setCity(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
            placeholder="City or area — e.g. Kathmandu, Pokhara"
            className="w-full pl-11 h-12 bg-muted/50 border-transparent rounded-xl text-sm focus-visible:ring-primary focus-visible:bg-white"
          />
          {city && (
            <button onClick={() => { setCity(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Popular city chips */}
        <div className="hidden md:flex gap-2 shrink-0">
          {POPULAR_CITIES.map(c => (
            <button
              key={c}
              onClick={() => {
                setCity(c);
                const params: Record<string, unknown> = { city: c };
                if (minPrice) params.minPrice = Number(minPrice);
                if (maxPrice) params.maxPrice = Number(maxPrice);
                if (roomType) params.roomType = roomType;
                if (tenantType) params.tenantType = tenantType;
                if (parking) params.parking = true;
                setQueryParams(params);
                setLocation(`/search?city=${encodeURIComponent(c)}`);
              }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                city === c ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex gap-2 w-full md:w-auto shrink-0">
          <Button onClick={applyFilters} size="sm" className="h-10 rounded-xl flex-1 md:flex-none px-5">
            <SearchIcon size={16} className="mr-1.5" /> Search
          </Button>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={activeFilterCount > 1 ? "secondary" : "outline"}
            size="sm"
            className="h-10 rounded-xl px-3 relative shrink-0"
          >
            <SlidersHorizontal size={16} />
            {activeFilterCount > 1 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {activeFilterCount - (city ? 1 : 0)}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile city chips */}
      <div className="flex md:hidden gap-2 overflow-x-auto pb-1 px-0.5 -mt-2">
        {POPULAR_CITIES.map(c => (
          <button
            key={c}
            onClick={() => {
              setCity(c);
              setQueryParams({ city: c });
              setLocation(`/search?city=${encodeURIComponent(c)}`);
            }}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium border shrink-0 transition-all",
              city === c ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* Sidebar Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full md:w-[260px] shrink-0 bg-white p-5 rounded-2xl shadow-sm border border-border md:sticky md:top-[170px]"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-base">Filters</h3>
                <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold mb-2 block text-muted-foreground uppercase tracking-wide">Price Range (NPR/month)</label>
                  <div className="flex gap-2 items-center">
                    <Input type="number" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="rounded-xl h-10 text-sm" />
                    <span className="text-muted-foreground text-sm">–</span>
                    <Input type="number" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="rounded-xl h-10 text-sm" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-2 block text-muted-foreground uppercase tracking-wide">Room Type</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(RoomRoomType).map(type => (
                      <button
                        key={type}
                        onClick={() => setRoomType(roomType === type ? "" : type)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize border",
                          roomType === type ? "bg-primary/10 border-primary text-primary" : "bg-white border-border text-muted-foreground hover:border-primary/30"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-2 block text-muted-foreground uppercase tracking-wide">Preferred For</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(RoomTenantType).map(type => (
                      <button
                        key={type}
                        onClick={() => setTenantType(tenantType === type ? "" : type)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-medium capitalize border transition-all",
                          tenantType === type ? "bg-secondary/10 border-secondary text-secondary" : "bg-white border-border text-muted-foreground hover:border-secondary/30"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                  <input type="checkbox" className="peer sr-only" checked={parking} onChange={e => setParking(e.target.checked)} />
                  <div className="w-5 h-5 rounded-md border-2 border-muted-foreground peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-colors shrink-0">
                    {parking && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className="font-medium text-sm">Parking Available</span>
                </label>

                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" className="flex-1 rounded-xl h-9 text-sm" onClick={clearFilters}>Clear All</Button>
                  <Button className="flex-1 rounded-xl h-9 text-sm" onClick={applyFilters}>Apply</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="flex-1 w-full">
          <div className="mb-5 flex justify-between items-end">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {city ? `Rooms in ${city}` : "All Rooms"}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {isLoading ? "Searching..." : `${data?.total ?? 0} room${(data?.total ?? 0) !== 1 ? "s" : ""} found`}
              </p>
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
                <X size={12} /> Clear filters
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-card rounded-2xl h-[320px] animate-pulse border border-border" />
              ))}
            </div>
          ) : data?.rooms && data.rooms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.rooms.map((room, i) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                >
                  <RoomCard room={room} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-28 bg-white rounded-2xl border border-dashed border-border/60">
              <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <SearchIcon size={28} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">No rooms found</h3>
              <p className="text-muted-foreground text-sm mb-5">
                {city ? `No listings in ${city} yet. Try a nearby city.` : "Try different filters."}
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
