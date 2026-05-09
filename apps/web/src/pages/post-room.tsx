import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateRoom, CreateRoomInputRoomType, CreateRoomInputTenantType } from "@workspace/api-client-react";
import { useAuth, isRealUserLoggedIn } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, MapPin, Loader2, CheckCircle2, ShieldCheck, Lock, X, ImagePlus } from "lucide-react";
import { motion } from "framer-motion";
import { useMultiUpload } from "@/hooks/use-upload";
import { BackButton } from "@/components/back-button";

const NEPAL_CITIES: Record<string, string[]> = {
  "Kathmandu": ["Baneshwor", "Thamel", "Lazimpat", "Koteshwor", "Kalanki", "Kirtipur", "Chabahil", "Baluwatar", "Maharajgunj", "Sitapaila", "Budhanilkantha", "Naxal", "Dilli Bazar", "Putalisadak", "Hattisar", "New Baneshwor", "Kuleshwor", "Balkhu"],
  "Lalitpur": ["Patan", "Jawalakhel", "Lagankhel", "Imadol", "Sanepa", "Satdobato", "Kumaripati", "Mangalbazar", "Pulchowk", "Ekantakuna"],
  "Bhaktapur": ["Durbar Square Area", "Suryabinayak", "Katunje", "Sipadol", "Thimi"],
  "Pokhara": ["Lakeside", "Newroad", "Mahendrapul", "Bagar", "Prithvi Chowk", "Airport Road", "Seti Dobhan", "Matepani"],
  "Biratnagar": ["Traffic Chowk", "Tankisinwari", "Rangeli Road", "Budha Nagar", "Rajbiraj Road"],
  "Dharan": ["Putali Line", "B.P. Chowk", "Bijayapur", "Fikkal Road"],
  "Birgunj": ["Ghantaghar", "Adarsh Nagar", "Powerhouse", "Rangeli"],
  "Butwal": ["Milanchowk", "Golpark", "Traffic", "Dobilla"],
  "Hetauda": ["Kohalpur Road", "Bhimphedi Road", "Sindhuli Road"],
  "Chitwan": ["Bharatpur", "Narayanghat", "Ratnanagar", "Tandi"],
  "Dhangadhi": ["Pipalchowk", "Seti Zone", "Attariya"],
};

const formSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters"),
  description: z.string().min(20, "Please provide more details"),
  price: z.coerce.number().min(1000, "Price must be at least NPR 1,000"),
  roomType: z.enum(["single", "double", "flat", "studio", "shared"]),
  tenantType: z.enum(["any", "family", "student", "male", "female", "professional"]),
  city: z.string().min(2, "City is required"),
  area: z.string().min(2, "Area/Tole is required"),
  streetAddress: z.string().optional(),
  landmark: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90, "Invalid latitude"),
  longitude: z.coerce.number().min(-180).max(180, "Invalid longitude"),
  parking: z.boolean().default(false),
  amenities: z.string().transform(str => str.split(',').map(s => s.trim()).filter(Boolean)),
});

const CITY_COORDS: Record<string, [number, number]> = {
  "Kathmandu": [27.7172, 85.3240],
  "Lalitpur": [27.6588, 85.3247],
  "Bhaktapur": [27.6722, 85.4298],
  "Pokhara": [28.2096, 83.9856],
  "Biratnagar": [26.4525, 87.2718],
  "Dharan": [26.8120, 87.2832],
  "Birgunj": [27.0103, 84.8779],
  "Butwal": [27.7006, 83.4483],
  "Hetauda": [27.4287, 85.0332],
  "Chitwan": [27.5291, 84.3542],
  "Dhangadhi": [28.6935, 80.5956],
};

export default function PostRoom() {
  const { userId, isVerified, isOwner } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedCity, setSelectedCity] = useState("Kathmandu");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadAll, uploading, uploadedCount, total } = useMultiUpload();
  const [gettingLocation, setGettingLocation] = useState(false);

  const createMutation = useCreateRoom({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Room Posted Successfully!" });
        setLocation(`/room/${data.id}`);
      },
      onError: (err: any) => {
        toast({ title: "Failed to post room", description: err.message, variant: "destructive" });
      }
    }
  });

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { roomType: "single", tenantType: "any", parking: false, city: "Kathmandu", latitude: 27.7172, longitude: 85.3240 }
  });

  const watchedCity = watch("city");

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", description: "Your browser doesn't support location services.", variant: "destructive" });
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue("latitude", position.coords.latitude);
        setValue("longitude", position.coords.longitude);
        setGettingLocation(false);
        toast({ title: "Location obtained", description: "GPS coordinates have been filled." });
      },
      (error) => {
        setGettingLocation(false);
        let message = "Unable to get location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location access denied. Please allow location access and try again.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            message = "Location request timed out.";
            break;
        }
        toast({ title: "Location error", description: message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photoFiles.length + files.length > 7) {
      toast({ title: "Maximum 7 photos allowed", variant: "destructive" });
      return;
    }
    setPhotoFiles(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setPhotoPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
    // Adjust cover photo index if needed
    if (idx === coverPhotoIndex && coverPhotoIndex > 0) {
      setCoverPhotoIndex(coverPhotoIndex - 1);
    } else if (idx < coverPhotoIndex) {
      setCoverPhotoIndex(coverPhotoIndex - 1);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Validate minimum 3 photos
    if (photoFiles.length < 3) {
      toast({ title: "At least 3 photos are required", description: `Please upload at least 3 photos. Currently: ${photoFiles.length}`, variant: "destructive" });
      return;
    }

    const address = [values.area, values.streetAddress, values.city].filter(Boolean).join(", ");

    let photos: string[] = [];
    if (photoFiles.length > 0) {
      try {
        const results = await uploadAll(photoFiles);
        // Reorder photos so cover photo is first
        const uploadedPhotos = results.map(r => r.url);
        if (coverPhotoIndex !== 0) {
          const coverPhoto = uploadedPhotos[coverPhotoIndex];
          const reorderedPhotos = [coverPhoto, ...uploadedPhotos.slice(0, coverPhotoIndex), ...uploadedPhotos.slice(coverPhotoIndex + 1)];
          photos = reorderedPhotos;
        } else {
          photos = uploadedPhotos;
        }
      } catch {
        toast({ title: "Photo upload failed", description: "Please try again", variant: "destructive" });
        return;
      }
    }

    createMutation.mutate({
      data: {
        title: values.title,
        description: values.description,
        price: values.price,
        roomType: values.roomType,
        tenantType: values.tenantType,
        city: values.city,
        address,
        parking: values.parking,
        amenities: values.amenities,
        ownerId: userId,
        latitude: values.latitude,
        longitude: values.longitude,
        nearbyLandmarks: values.landmark ? [values.landmark] : [],
        photos,
      } as any
    });
  };

  if (!isRealUserLoggedIn()) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 bg-white rounded-3xl border border-border shadow-xl px-6 mt-10">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock size={36} />
        </div>
        <h2 className="text-3xl font-bold mb-4">Sign In Required</h2>
        <p className="text-muted-foreground text-lg mb-8">You need to create an account and verify your identity before posting a room listing.</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => setLocation('/login')} variant="outline" size="lg" className="rounded-xl h-12 px-8">Sign In</Button>
          <Button onClick={() => setLocation('/register')} size="lg" className="rounded-xl h-12 px-8">Create Account</Button>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 bg-white rounded-3xl border border-border shadow-xl px-6 mt-10">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck size={36} />
        </div>
        <h2 className="text-3xl font-bold mb-4">Owners Only</h2>
        <p className="text-muted-foreground text-lg mb-8">Only users registered as owners can post room listings.</p>
        <Button onClick={() => setLocation('/search')} size="lg" className="rounded-xl h-12 px-8">Browse Rooms</Button>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 bg-white rounded-3xl border border-border shadow-xl px-6 mt-10">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck size={36} />
        </div>
        <h2 className="text-3xl font-bold mb-4">Verification Required</h2>
        <p className="text-muted-foreground text-lg mb-8">Complete identity verification before posting rooms.</p>
        <Button onClick={() => setLocation('/verification')} size="lg" className="rounded-xl h-14 px-8 text-lg">Verify My Identity Now</Button>
      </div>
    );
  }

  const areas = NEPAL_CITIES[watchedCity] ?? [];
  const isSubmitting = createMutation.isPending || uploading;

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 md:p-10 rounded-3xl border border-border shadow-lg mb-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <BackButton fallback="/my-listings" label="Back" className="" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground mb-2">Post a Room</h1>
        <p className="text-muted-foreground">Fill in the details to list your property on Ghar Khoj.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b pb-2">Basic Information</h2>
          <div>
            <label className="font-medium text-sm mb-1.5 block">Listing Title</label>
            <Input {...register("title")} placeholder="e.g., Spacious 2BHK Flat in Baneshwor" className="h-12 bg-muted/30" />
            {errors.title && <p className="text-destructive text-sm mt-1">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="font-medium text-sm mb-1.5 block">Monthly Rent (NPR)</label>
              <Input type="number" {...register("price")} placeholder="e.g., 15000" className="h-12 bg-muted/30" />
              {errors.price && <p className="text-destructive text-sm mt-1">{errors.price.message}</p>}
            </div>
            <div>
              <label className="font-medium text-sm mb-1.5 block">Room Type</label>
              <select {...register("roomType")} className="flex h-12 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {Object.values(CreateRoomInputRoomType).map(v => (
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b pb-2 flex items-center gap-2"><MapPin size={18} className="text-primary" /> Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="font-medium text-sm mb-1.5 block">City</label>
              <select
                {...register("city")}
                onChange={e => { setValue("city", e.target.value); setSelectedCity(e.target.value); setValue("area", ""); }}
                className="flex h-12 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Object.keys(NEPAL_CITIES).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.city && <p className="text-destructive text-sm mt-1">{errors.city.message}</p>}
            </div>
            <div>
              <label className="font-medium text-sm mb-1.5 block">Area / Tole</label>
              <select {...register("area")} className="flex h-12 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Select area…</option>
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {errors.area && <p className="text-destructive text-sm mt-1">{errors.area.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="font-medium text-sm mb-1.5 block">Street / House No <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input {...register("streetAddress")} placeholder="e.g., House No. 45, Lane 3" className="h-12 bg-muted/30" />
            </div>
            <div>
              <label className="font-medium text-sm mb-1.5 block">Nearest Landmark <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input {...register("landmark")} placeholder="e.g., Near XYZ School" className="h-12 bg-muted/30" />
            </div>
          </div>
          <div className="space-y-3">
            <label className="font-medium text-sm block">GPS Coordinates</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Input type="number" step="any" {...register("latitude")} placeholder="Latitude" className="h-12 bg-muted/30" />
                {errors.latitude && <p className="text-destructive text-sm mt-1">{errors.latitude.message}</p>}
              </div>
              <div>
                <Input type="number" step="any" {...register("longitude")} placeholder="Longitude" className="h-12 bg-muted/30" />
                {errors.longitude && <p className="text-destructive text-sm mt-1">{errors.longitude.message}</p>}
              </div>
              <Button type="button" onClick={getCurrentLocation} disabled={gettingLocation} className="h-12 rounded-xl">
                {gettingLocation ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                {gettingLocation ? "Getting..." : "Get Current Location"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Click "Get Current Location" to auto-fill GPS coordinates. This helps tenants find your room on the map.</p>
          </div>
        </section>

        {/* Details */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b pb-2">Details & Preferences</h2>
          <div>
            <label className="font-medium text-sm mb-1.5 block">Description</label>
            <Textarea {...register("description")} placeholder="Describe the room — sunlight, ventilation, water supply, floor level, shared/private bathroom, etc." className="min-h-[130px] bg-muted/30 resize-none" />
            {errors.description && <p className="text-destructive text-sm mt-1">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="font-medium text-sm mb-1.5 block">Preferred Tenant</label>
              <select {...register("tenantType")} className="flex h-12 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {Object.values(CreateRoomInputTenantType).map(v => (
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-medium text-sm mb-1.5 block">Facilities (comma separated)</label>
              <Input {...register("amenities")} placeholder="WiFi, 24/7 Water, Attached Bathroom" className="h-12 bg-muted/30" />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
            <input type="checkbox" {...register("parking")} className="w-5 h-5 accent-primary rounded" />
            <span className="font-medium">Parking Space Available</span>
          </label>
        </section>

        {/* Photos */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold border-b pb-2 flex-1">Photos</h2>
            <div className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-lg font-medium">
              {photoPreviews.length}/7 photos
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">📸 Photo Requirements</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Minimum 3 photos required (at least)</li>
              <li>Maximum 7 photos allowed</li>
              <li>Tap a photo to set it as the cover photo</li>
              <li>High-quality photos attract more tenants</li>
            </ul>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoSelect}
          />

          {photoPreviews.length > 0 && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                <p className="font-semibold text-xs mb-1">👑 Cover Photo</p>
                <p className="text-xs">Photo #{coverPhotoIndex + 1} will display first in listings</p>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {photoPreviews.map((src, i) => (
                  <div
                    key={i}
                    onClick={() => setCoverPhotoIndex(i)}
                    className={`relative group rounded-xl overflow-hidden aspect-square cursor-pointer transition-all ${i === coverPhotoIndex ? "ring-3 ring-primary shadow-lg" : "border-2 border-gray-200 hover:border-gray-300"}`}
                  >
                    <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(i);
                      }}
                      className="absolute top-1.5 right-1.5 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                    {i === coverPhotoIndex && (
                      <span className="absolute bottom-1.5 left-1.5 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                        👑 Cover
                      </span>
                    )}
                    <span className="absolute top-1.5 left-1.5 bg-black/50 text-white text-xs font-semibold px-2 py-0.5 rounded">
                      #{i + 1}
                    </span>
                  </div>
                ))}
                {photoPreviews.length < 7 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center text-primary/50 hover:text-primary hover:border-primary/60 transition-colors"
                  >
                    <ImagePlus size={24} />
                    <span className="text-xs mt-1">Add more</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {photoPreviews.length === 0 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-primary/10 transition-colors"
            >
              <Camera className="text-primary/50 mb-3" size={40} />
              <p className="font-semibold text-primary">Click to upload photos</p>
              <p className="text-sm text-muted-foreground mt-1">JPEG, PNG · Up to 8 photos · High quality attracts better tenants</p>
            </div>
          )}

          {uploading && (
            <div className="bg-muted/30 rounded-xl p-3 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin text-primary" />
              Uploading photos… {uploadedCount}/{total}
            </div>
          )}
        </section>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-14 rounded-xl text-lg font-bold shadow-xl shadow-primary/20"
        >
          {isSubmitting
            ? <><Loader2 className="mr-2 animate-spin" /> {uploading ? `Uploading photos… ${uploadedCount}/${total}` : "Publishing…"}</>
            : <><CheckCircle2 className="mr-2" size={20} /> Publish Room Listing</>
          }
        </Button>
      </form>
    </div>
  );
}
