import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, AlertCircle, CheckCircle2, FileText, Upload, Camera, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { uploadFile } from "@/hooks/use-upload";

const DOC_TYPES = [
  { value: "citizenship", label: "Citizenship Certificate" },
  { value: "passport", label: "Passport" },
  { value: "nid", label: "National ID" },
  { value: "license", label: "Driving License" },
];

export default function Verification() {
  const { userId, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [docType, setDocType] = useState("citizenship");
  const [docNumber, setDocNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [issueDate, setIssueDate] = useState("");

  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const handleDocFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFile(file);
    const reader = new FileReader();
    reader.onload = ev => setDocPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSelfieFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    const reader = new FileReader();
    reader.onload = ev => setSelfiePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  if (user?.verificationStatus === "pending") {
    return (
      <div className="max-w-xl mx-auto mt-10 p-10 bg-white rounded-2xl text-center border shadow-sm">
        <AlertCircle size={56} className="text-amber-500 mx-auto mb-5" />
        <h2 className="text-xl font-bold mb-2">Verification Under Review</h2>
        <p className="text-muted-foreground text-sm">Your documents have been submitted and are being reviewed by our team. This usually takes a few hours.</p>
        <Button className="mt-6" variant="outline" onClick={() => setLocation("/profile")}>Back to Profile</Button>
      </div>
    );
  }

  if (user?.isVerified) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-10 bg-white rounded-2xl text-center border shadow-sm">
        <CheckCircle2 size={56} className="text-green-500 mx-auto mb-5" />
        <h2 className="text-xl font-bold mb-2">Identity Verified</h2>
        <p className="text-muted-foreground text-sm">Your identity has been confirmed. You are a verified member of Ghar Khoj.</p>
        <Button className="mt-6" onClick={() => setLocation("/")}>Go to Home</Button>
      </div>
    );
  }

  const handleSubmit = async () => {
    // Clear previous errors
    setFieldErrors({});

    if (!docNumber.trim() || !fullName.trim() || !dob || !issueDate) {
      toast({ title: "All fields are required", description: "Please fill in all identity details.", variant: "destructive" });
      return;
    }

    if (!docFile || !selfieFile) {
      toast({ title: "Upload required", description: "Please attach both a document photo and a selfie.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let docUrl = "pending-upload";
      let selfieUrl = "pending-upload";
      let docPhotoUrl: string | null = null;

      if (docFile) {
        const result = await uploadFile(docFile);
        docUrl = result.url;
        docPhotoUrl = result.url;
      }
      if (selfieFile) {
        const result = await uploadFile(selfieFile);
        selfieUrl = result.url;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = typeof window !== "undefined"
        ? localStorage.getItem("ghar_khoj_jwt")
        : null;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`/api/verification`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          docType,
          citizenshipNumber: docNumber.trim(),
          fullNameCitizenship: fullName.trim(),
          dateOfBirth: dob,
          issueDate,
          docUrl,
          selfieUrl,
          docPhotoUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.log('Error response:', data);

        const newFieldErrors: Record<string, string> = {};

        // Handle detailed validation errors array
        const fieldMap: Record<string, string> = {
          docType: 'docType',
          citizenshipNumber: 'docNumber',
          fullNameCitizenship: 'fullName',
          dateOfBirth: 'dob',
          issueDate: 'issueDate',
        };

        if (data.details && Array.isArray(data.details)) {
          data.details.forEach((detail: any) => {
            if (typeof detail === 'string') {
              if (detail.includes('docType')) newFieldErrors.docType = detail;
              else if (detail.includes('citizenshipNumber')) newFieldErrors.docNumber = detail;
              else if (detail.includes('fullNameCitizenship')) newFieldErrors.fullName = detail;
              else if (detail.includes('dateOfBirth')) newFieldErrors.dob = detail;
              else if (detail.includes('issueDate')) newFieldErrors.issueDate = detail;
            } else if (detail?.field && detail?.message) {
              const mappedField = fieldMap[detail.field] || detail.field;
              newFieldErrors[mappedField] = detail.message;
            }
          });
        }

        // Handle single field error
        if (data.field) {
          const mappedField = fieldMap[data.field] || data.field;
          newFieldErrors[mappedField] = data.message;
        }

        // Set errors and show toast
        if (Object.keys(newFieldErrors).length > 0) {
          setFieldErrors(newFieldErrors);
        }

        const toastMessage = Object.values(newFieldErrors)[0] || data.message || "Submission failed";
        throw new Error(toastMessage);
      }

      toast({ title: "Documents submitted!", description: "Admin will verify your identity shortly." });
      setLocation("/profile");
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
          <ShieldCheck className="text-green-600" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Verify Your Identity</h1>
          <p className="text-muted-foreground text-sm">Required for posting listings and direct contact with room owners</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <strong>Why we verify:</strong> Ghar Khoj verifies every user to prevent fraud and ensure genuine landlords and tenants. Your information is securely stored and only used for this purpose.
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm divide-y divide-border">
        {/* Document type */}
        <div className="p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><FileText size={16} /> Document Type</h3>
          <div className="flex flex-wrap gap-3">
            {DOC_TYPES.map(d => (
              <button
                key={d.value}
                onClick={() => { setDocType(d.value); setFieldErrors(prev => ({ ...prev, docType: '' })); }}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${docType === d.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"} ${fieldErrors.docType ? 'border-red-500' : ''}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {fieldErrors.docType && <p className="text-xs text-red-600 mt-2">{fieldErrors.docType}</p>}
        </div>

        {/* Identity details */}
        <div className="p-6 space-y-5">
          <h3 className="font-semibold text-foreground mb-1">Identity Details</h3>
          <p className="text-xs text-muted-foreground -mt-3">Enter exactly as written on your document</p>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">
              {docType === "citizenship" ? "Citizenship Number" : docType === "passport" ? "Passport Number" : docType === "license" ? "License Number" : "ID Number"} *
            </label>
            <Input
              value={docNumber}
              onChange={e => { setDocNumber(e.target.value); setFieldErrors(prev => ({ ...prev, docNumber: '' })); }}
              placeholder={docType === "citizenship" ? "e.g. 12-34-56-78901" : "Enter document number"}
              className={`rounded-xl font-mono ${fieldErrors.docNumber ? 'border-red-500' : ''}`}
            />
            {fieldErrors.docNumber && <p className="text-xs text-red-600 mt-1">{fieldErrors.docNumber}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Full Name (as in document) *</label>
            <Input
              value={fullName}
              onChange={e => { setFullName(e.target.value); setFieldErrors(prev => ({ ...prev, fullName: '' })); }}
              placeholder="e.g. Ramesh Kumar Sharma"
              className={`rounded-xl ${fieldErrors.fullName ? 'border-red-500' : ''}`}
            />
            {fieldErrors.fullName && <p className="text-xs text-red-600 mt-1">{fieldErrors.fullName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Date of Birth *</label>
              <Input
                type="date"
                value={dob}
                onChange={e => { setDob(e.target.value); setFieldErrors(prev => ({ ...prev, dob: '' })); }}
                className={`rounded-xl ${fieldErrors.dob ? 'border-red-500' : ''}`}
              />
              {fieldErrors.dob && <p className="text-xs text-red-600 mt-1">{fieldErrors.dob}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Issue Date *</label>
              <Input
                type="date"
                value={issueDate}
                onChange={e => { setIssueDate(e.target.value); setFieldErrors(prev => ({ ...prev, issueDate: '' })); }}
                className={`rounded-xl ${fieldErrors.issueDate ? 'border-red-500' : ''}`}
              />
              {fieldErrors.issueDate && <p className="text-xs text-red-600 mt-1">{fieldErrors.issueDate}</p>}
            </div>
          </div>
        </div>

        {/* Document photo upload */}
        <div className="p-6 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Upload size={16} /> Upload Documents</h3>
          <p className="text-xs text-muted-foreground">Upload a clear photo of your document and a selfie holding it.</p>

          <input ref={docInputRef} type="file" accept="image/*" className="hidden" onChange={handleDocFile} />
          <input ref={selfieInputRef} type="file" accept="image/*" className="hidden" onChange={handleSelfieFile} />

          <div className="grid grid-cols-2 gap-4">
            {/* Document photo */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Document Photo</p>
              {docPreview ? (
                <div className="relative rounded-xl overflow-hidden border aspect-video group">
                  <img src={docPreview} alt="Document" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setDocFile(null); setDocPreview(null); }}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => docInputRef.current?.click()}
                  className="w-full aspect-video border-2 border-dashed border-muted-foreground/30 rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <FileText size={24} className="mb-2" />
                  <p className="text-xs font-medium">Upload document</p>
                  <p className="text-[10px] mt-0.5">JPG, PNG</p>
                </button>
              )}
            </div>

            {/* Selfie */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Selfie with Document</p>
              {selfiePreview ? (
                <div className="relative rounded-xl overflow-hidden border aspect-video group">
                  <img src={selfiePreview} alt="Selfie" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setSelfieFile(null); setSelfiePreview(null); }}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => selfieInputRef.current?.click()}
                  className="w-full aspect-video border-2 border-dashed border-muted-foreground/30 rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Camera size={24} className="mb-2" />
                  <p className="text-xs font-medium">Upload selfie</p>
                  <p className="text-[10px] mt-0.5">Hold document clearly</p>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="p-6">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 rounded-xl font-semibold bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Uploading & Submitting…</> : "Submit for Verification"}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Your data is encrypted and only visible to Ghar Khoj admins for verification purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
