import { useRoute, useLocation } from "wouter";
import { useGetRoom, useGetUser, useCreateInteraction, useGetTenantMatches, getGetUserQueryKey, getGetTenantMatchesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { customFetch, customFetchRaw } from "@/lib/customFetch";
import { MapPin, ShieldCheck, Heart, MessageSquare, Car, Wifi, Droplets, Zap, BedDouble, Share2, Info, CheckCircle2, Users, Sparkles, Loader2, ChevronLeft, ChevronRight, X, Edit, Trash2, Plus, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn, getMediaUrl } from "@/lib/utils";
import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { RoomMap } from "@/components/room-map";
import { useMultiUpload } from "@/hooks/use-upload";
import { BackButton } from "@/components/back-button";

export default function RoomDetail() {
  const [, params] = useRoute("/room/:id");
  const roomId = parseInt(params?.id || "0");
  const [, navigate] = useLocation();

  const { data: room, isLoading: roomLoading, refetch: refetchRoom } = useGetRoom(roomId);
  const { data: owner, isLoading: ownerLoading } = useGetUser(room?.ownerId || 0, {
    query: { queryKey: getGetUserQueryKey(room?.ownerId || 0), enabled: !!room?.ownerId }
  });

  const { userId, user, isVerified, isTenant, isRealUser } = useAuth();
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [photoManagerIndex, setPhotoManagerIndex] = useState(0);
  const [sendingInterest, setSendingInterest] = useState(false);
  const [showPhotoManager, setShowPhotoManager] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(false);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const { uploadAll, uploading: photoUploading } = useMultiUpload();

  const { data: matchData, refetch: refetchMatches } = useGetTenantMatches(
    userId ?? 0,
    { query: { queryKey: getGetTenantMatchesQueryKey(userId ?? 0), enabled: isRealUser && !!userId } }
  );

  const roomMatch = matchData?.matches?.find(match => match.roomId === room?.id);
  const matchStatus = roomMatch?.status;
  const matchAccepted = matchStatus === "accepted";
  const matchPending = matchStatus === "pending";
  const hasMatch = !!roomMatch;

  const saveMutation = useCreateInteraction();

  // Auto-log room view interaction for recommendation algorithm
  useEffect(() => {
    if (room && userId && isRealUser) {
      saveMutation.mutate({ data: { roomId: room.id, userId, type: "view" } });
    }
  }, [room?.id, userId]);

  const handleSave = () => {
    if (!isSaved && room) {
      saveMutation.mutate({ data: { roomId: room.id, userId, type: "save" } });
      setIsSaved(true);
      toast({ title: "Saved" });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied" });
  };

  const handleInterested = async () => {
    if (!room || !isRealUser || !userId) {
      toast({ title: "Sign in required", description: "Please sign in to show interest", variant: "destructive" });
      return;
    }
    setSendingInterest(true);
    try {
      const token = localStorage.getItem("ghar_khoj_jwt");
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      // Use customFetch so backend JSON error messages are thrown as Error(message)
      await customFetch("/api/matches", {
        method: "POST",
        headers,
        body: JSON.stringify({ tenantId: userId, ownerId: room.ownerId, roomId: room.id }),
      });

      refetchMatches();
      saveMutation.mutate({ data: { roomId: room.id, userId, type: "save" } });
      toast({ title: "Interest sent!", description: "The owner will be notified. Chat opens when they accept you." });
    } catch (err: any) {
      const message = err?.message || "Failed to send interest";
      toast({ title: message, variant: "destructive" });
    } finally {
      setSendingInterest(false);
    }
  };

  const handleDeletePhoto = async (photoIndex: number) => {
    if (!room || !isOwnRoom) return;
    
    if (!confirm("Delete this photo permanently?")) return;

    const newPhotos = room.photos.filter((_, i) => i !== photoIndex);
    try {
      const token = localStorage.getItem("ghar_khoj_jwt");
      if (!token) {
        toast({ title: "Authentication required", variant: "destructive" });
        return;
      }
      const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

      const res = await customFetchRaw(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ photos: newPhotos }),
      });
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(errorBody || "Request failed");
      }
      toast({ title: "Photo deleted" });
      refetchRoom();
    } catch (err: any) {
      toast({ title: "Failed to delete photo", description: err?.message ?? "Please try again", variant: "destructive" });
    }
  };

  const handleNewPhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.currentTarget.value = "";
    if ((room?.photos.length || 0) + newPhotoFiles.length + files.length > 7) {
      toast({ title: "Maximum 7 photos allowed", variant: "destructive" });
      return;
    }
    setNewPhotoFiles(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setNewPhotoPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const handleAddPhotos = async () => {
    if (!room || !isOwnRoom || newPhotoFiles.length === 0) return;

    try {
      const results = await uploadAll(newPhotoFiles);
      const newPhotosUrls = results.map(r => r.url);
      const allPhotos = [...room.photos, ...newPhotosUrls];

      const token = localStorage.getItem("ghar_khoj_jwt");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await customFetchRaw(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ photos: allPhotos }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Photos added successfully!" });
      setNewPhotoFiles([]);
      setNewPhotoPreviews([]);
      setEditingPhotos(false);
      refetchRoom();
    } catch {
      toast({ title: "Failed to add photos", variant: "destructive" });
    }
  };

  const handleSetCoverPhoto = async (photoIndex: number) => {
    if (!room || !isOwnRoom) return;

    try {
      const token = localStorage.getItem("ghar_khoj_jwt");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Reorder photos to make the selected one first
      const newPhotos = [
        room.photos[photoIndex],
        ...room.photos.slice(0, photoIndex),
        ...room.photos.slice(photoIndex + 1)
      ];

      const res = await customFetchRaw(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ photos: newPhotos }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Cover photo updated!" });
      setActiveImage(0);
      refetchRoom();
    } catch {
      toast({ title: "Failed to update cover photo", variant: "destructive" });
    }
  };

  const validPhotos = Array.isArray(room?.photos)
    ? room.photos.filter(photo => typeof photo === "string" && photo.trim() !== "")
    : [];
  const images = validPhotos.length > 0
    ? validPhotos
    : [`${import.meta.env.BASE_URL}images/empty-state.png`];
  const mainImage = getMediaUrl(images[activeImage] || images[0])
    || getMediaUrl(`${import.meta.env.BASE_URL}images/empty-state.png`);

  useEffect(() => {
    if (activeImage >= images.length) {
      setActiveImage(0);
    }
  }, [activeImage, images.length]);

  if (roomLoading) return <div className="h-[60vh] animate-pulse bg-muted rounded-2xl" />;
  if (!room) return <div className="p-20 text-center text-xl font-bold text-destructive">Room not found</div>;

  const isOwnRoom = userId === room.ownerId;

  const amenityIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("wifi")) return <Wifi size={18} className="text-blue-500" />;
    if (lower.includes("water")) return <Droplets size={18} className="text-cyan-500" />;
    if (lower.includes("electric")) return <Zap size={18} className="text-yellow-500" />;
    return <CheckCircle2 size={18} className="text-green-500" />;
  };

  return (
    <div className="pb-24 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 mb-2 md:mb-0">
          <BackButton fallback="/search" label="Back" className="" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-semibold capitalize">
                {room.roomType}
              </span>
              {room.isVerified && (
                <span className="bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg text-sm font-semibold flex items-center gap-1">
                  <ShieldCheck size={13} /> Verified
                </span>
              )}
              {!room.isAvailable && (
                <span className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-lg text-sm font-semibold">
                  Rented
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 leading-tight">
              {room.title}
            </h1>
            <p className="text-muted-foreground flex items-center gap-1.5 text-base">
              <MapPin className="text-primary shrink-0" size={16} />
              {room.address}, {room.city}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="icon" className="rounded-xl h-10 w-10" onClick={handleShare}>
            <Share2 size={17} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn("rounded-xl h-10 w-10", isSaved && "border-primary bg-primary/5")}
            onClick={handleSave}
          >
            <Heart size={17} className={cn(isSaved ? "fill-primary text-primary" : "")} />
          </Button>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="relative mb-8">
        <div className="relative h-[260px] md:h-[440px] rounded-2xl overflow-hidden shadow-md bg-black">
          <img
            src={mainImage}
            alt="Main"
            className="w-full h-full object-contain"
            onError={e => { e.currentTarget.src = `${import.meta.env.BASE_URL}images/empty-state.png`; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          <div className="absolute bottom-5 left-5 bg-white/95 backdrop-blur-sm px-5 py-2.5 rounded-xl shadow-lg">
            <p className="text-2xl font-black text-primary">{formatCurrency(room.price)}<span className="text-sm font-medium text-muted-foreground">/month</span></p>
          </div>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : images.length - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm hover:bg-white rounded-full p-2 shadow-lg transition-all"
              >
                <ChevronLeft size={20} className="text-gray-700" />
              </button>
              <button
                onClick={() => setActiveImage(prev => prev < images.length - 1 ? prev + 1 : 0)}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm hover:bg-white rounded-full p-2 shadow-lg transition-all"
              >
                <ChevronRight size={20} className="text-gray-700" />
              </button>
            </>
          )}

          {/* Owner edit/delete buttons */}
          {isOwnRoom && (
            <div className="absolute top-4 right-4 flex gap-2">
              <Button 
                size="sm" 
                variant="secondary" 
                className="bg-white/90 backdrop-blur-sm hover:bg-white flex items-center gap-2"
                onClick={() => {
                  setShowPhotoManager(true);
                  setPhotoManagerIndex(activeImage);
                }}
              >
                <Edit size={16} /> Manage Photos
              </Button>
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={cn(
                  "flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all",
                  activeImage === i ? "border-primary shadow-md" : "border-gray-200 hover:border-gray-300"
                )}
              >
                <img
                  src={getMediaUrl(img)}
                  alt={`Thumbnail ${i + 1}`}
                  className="w-full h-full object-contain"
                  onError={e => { e.currentTarget.src = `${import.meta.env.BASE_URL}images/empty-state.png`; }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-sm font-medium">
            {activeImage + 1} / {images.length}
          </div>
        )}

        {/* Photo Manager Overlay */}
        {showPhotoManager && isOwnRoom && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold">Photo Manager</h3>
                  <p className="text-sm text-muted-foreground">Select a photo, set cover, or delete an image from this listing.</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => {
                  setShowPhotoManager(false);
                  setEditingPhotos(false);
                  setNewPhotoFiles([]);
                  setNewPhotoPreviews([]);
                }}>
                  <X size={16} />
                </Button>
              </div>

              {!editingPhotos ? (
                <div className="space-y-6">
                  <div className="rounded-3xl overflow-hidden bg-muted border border-border">
                    <img
                      src={getMediaUrl(images[photoManagerIndex])}
                      alt={`Photo ${photoManagerIndex + 1}`}
                      className="w-full h-[420px] md:h-[520px] object-contain bg-black"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_auto] items-center">
                    <div className="flex items-center gap-3 overflow-x-auto py-2">
                      {images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setPhotoManagerIndex(i)}
                          className={cn(
                            "relative rounded-2xl overflow-hidden border transition-all focus:outline-none",
                            photoManagerIndex === i ? "border-primary shadow-lg" : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className="absolute top-2 left-2 bg-white/90 text-xs font-semibold px-2 py-1 rounded-full">
                            {i + 1}
                          </div>
                          <img src={getMediaUrl(img)} alt={`Thumbnail ${i + 1}`} className="w-20 h-20 object-contain" />
                        </button>
                      ))}
                    </div>
                    <div className="min-w-[170px]">
                      <label className="text-sm font-semibold text-muted-foreground">Select photo</label>
                      <select
                        value={photoManagerIndex}
                        onChange={e => setPhotoManagerIndex(Number(e.target.value))}
                        className="mt-2 block w-full rounded-2xl border border-input bg-white px-3 py-2 text-sm"
                      >
                        {images.map((_, i) => (
                          <option key={i} value={i}>Photo {i + 1}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {photoManagerIndex !== 0 ? (
                      <Button size="sm" variant="outline" onClick={() => handleSetCoverPhoto(photoManagerIndex)}>
                        👑 Set as Cover Photo
                      </Button>
                    ) : (
                      <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                        This photo is already the cover image.
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeletePhoto(photoManagerIndex)}
                      disabled={images.length <= 1}
                    >
                      <Trash2 size={14} className="mr-1" /> Delete Photo
                    </Button>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      Selected: {photoManagerIndex + 1} / {images.length}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {images.length < 7 && (
                        <Button size="sm" variant="outline" onClick={() => setEditingPhotos(true)}>
                          <Plus size={14} className="mr-1" /> Add Photos
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setShowPhotoManager(false)}>
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-dashed border-muted p-4">
                    <p className="text-sm font-semibold text-foreground">Upload new photos</p>
                    <p className="text-sm text-muted-foreground mt-1">You can add up to {7 - images.length} more photos.</p>
                  </div>

                  <input
                    ref={photoFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleNewPhotoSelect}
                  />

                  <Button size="sm" variant="outline" onClick={() => photoFileInputRef.current?.click()}>
                    <ImagePlus size={16} className="mr-2" /> Choose Images
                  </Button>

                  {newPhotoPreviews.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {newPhotoPreviews.map((preview, i) => (
                        <div key={i} className="relative rounded-2xl overflow-hidden border border-border">
                          <img src={preview} alt={`New photo ${i + 1}`} className="w-full h-32 object-contain" />
                          <button
                            type="button"
                            onClick={() => {
                              setNewPhotoFiles(prev => prev.filter((_, idx) => idx !== i));
                              setNewPhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
                            }}
                            className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button size="sm" onClick={handleAddPhotos} disabled={newPhotoFiles.length === 0 || photoUploading}>
                      {photoUploading ? "Uploading..." : "Upload Photos"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingPhotos(false); setNewPhotoFiles([]); setNewPhotoPreviews([]); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Description */}
          <section className="bg-white p-6 rounded-2xl border border-border">
            <h2 className="text-lg font-bold mb-3 text-foreground">About this room</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              {room.description || "No description provided."}
            </p>
          </section>

          {/* Details grid */}
          <section className="bg-white p-6 rounded-2xl border border-border">
            <h2 className="text-lg font-bold mb-4 text-foreground">Room Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                <BedDouble size={20} className="text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-sm capitalize">{room.roomType}</p>
                  <p className="text-xs text-muted-foreground">Room type</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                <Users size={20} className="text-secondary shrink-0" />
                <div>
                  <p className="font-semibold text-sm capitalize">{room.tenantType}</p>
                  <p className="text-xs text-muted-foreground">Preferred tenant</p>
                </div>
              </div>
              {room.parking && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                  <Car size={20} className="text-green-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Available</p>
                    <p className="text-xs text-muted-foreground">Parking</p>
                  </div>
                </div>
              )}
              {room.amenities?.map(amenity => (
                <div key={amenity} className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                  {amenityIcon(amenity)}
                  <p className="font-medium text-sm capitalize">{amenity}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Nearby landmarks */}
          {room.nearbyLandmarks && room.nearbyLandmarks.length > 0 && (
            <section className="bg-white p-6 rounded-2xl border border-border">
              <h2 className="text-lg font-bold mb-4 text-foreground">Nearby</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {room.nearbyLandmarks.map((lm: string, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <span className="text-xl shrink-0">
                      {lm.toLowerCase().includes("school") ? "🏫" :
                       lm.toLowerCase().includes("hospital") ? "🏥" :
                       lm.toLowerCase().includes("temple") ? "🛕" :
                       lm.toLowerCase().includes("bus") ? "🚌" :
                       lm.toLowerCase().includes("market") ? "🛒" : "📍"}
                    </span>
                    <span className="text-sm font-medium">{lm}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Map section */}
          {room.latitude && room.longitude && (
            <section className="bg-white p-6 rounded-2xl border border-border">
              <h2 className="text-lg font-bold mb-4 text-foreground">Location</h2>
              <RoomMap
                roomLat={room.latitude}
                roomLng={room.longitude}
                roomTitle={room.title}
                roomAddress={`${room.address}, ${room.city}`}
              />
            </section>
          )}
        </div>

        {/* Right: Owner + Action */}
        <div className="space-y-4">
          <div className="sticky top-[80px]">
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <h3 className="font-bold text-base mb-5 text-foreground">Owner</h3>

              {ownerLoading ? (
                <div className="animate-pulse flex gap-3 items-center mb-5">
                  <div className="w-14 h-14 bg-muted rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2.5 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ) : owner ? (
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                    {owner.firstName[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                      {owner.firstName} {owner.lastName}
                      {owner.isVerified && <ShieldCheck className="text-green-500" size={15} />}
                    </h4>
                    <p className="text-muted-foreground text-xs mt-0.5">Verified Property Owner</p>
                  </div>
                </div>
              ) : null}

              {/* Action buttons based on role */}
              {!isRealUser ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    Please sign in to show interest and access chat with the owner.
                  </p>
                  <Link href="/login">
                    <Button size="default" className="w-full rounded-xl font-semibold">
                      Sign In to Continue
                    </Button>
                  </Link>
                </div>
              ) : isOwnRoom ? (
                <Link href="/my-listings">
                  <Button variant="outline" className="w-full rounded-xl">
                    Manage This Listing
                  </Button>
                </Link>
              ) : isTenant ? (
                <div className="space-y-2">
                  {matchAccepted ? (
                    <Link href={`/messages/${userId}/${room.ownerId}`}>
                      <Button variant="outline" size="default" className="w-full rounded-xl">
                        <MessageSquare className="mr-2" size={16} /> Message Owner
                      </Button>
                    </Link>
                  ) : matchPending ? (
                    <div className="w-full h-12 rounded-xl bg-green-50 border border-green-200 text-green-700 font-semibold flex items-center justify-center gap-2 text-sm">
                      <CheckCircle2 size={16} /> Interest Sent — Waiting for Owner
                    </div>
                  ) : (
                    <Button
                      size="default"
                      className="w-full rounded-xl font-semibold gap-2 bg-primary"
                      onClick={handleInterested}
                      disabled={sendingInterest || !room.isAvailable}
                    >
                      {sendingInterest
                        ? <><Loader2 size={16} className="animate-spin" /> Sending…</>
                        : <><Sparkles size={16} /> I'm Interested</>}
                    </Button>
                  )}
                </div>
              ) : (
                <Link href={`/messages/${userId}/${room.ownerId}`}>
                  <Button size="default" className="w-full rounded-xl font-semibold">
                    <MessageSquare className="mr-2" size={16} /> Send Message
                  </Button>
                </Link>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2 text-center">Payment methods accepted</p>
                <div className="flex justify-center gap-2">
                  <div className="bg-[#60bb46] text-white text-[10px] font-bold px-2.5 py-1 rounded-md">eSewa</div>
                  <div className="bg-[#5C2D91] text-white text-[10px] font-bold px-2.5 py-1 rounded-md">Khalti</div>
                  <div className="bg-[#DC143C] text-white text-[10px] font-bold px-2.5 py-1 rounded-md">IME Pay</div>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-amber-50 border border-amber-200 p-4 rounded-2xl">
              <h4 className="font-semibold text-amber-800 text-sm flex items-center gap-1.5 mb-1.5">
                <Info size={14} /> Safety Reminder
              </h4>
              <p className="text-xs text-amber-900/80 leading-relaxed">
                Never pay before visiting the room and signing an agreement. Ghar Khoj does not handle any payments between users.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
