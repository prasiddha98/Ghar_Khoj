import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, X, Download, File } from "lucide-react";
import { cn, getMediaUrl } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface VerificationDocument {
  id: number;
  userId: number;
  docType: string;
  docUrl?: string;
  selfieUrl?: string;
  status: string;
  fullNameCitizenship?: string;
  dateOfBirth?: string;
  citizenshipNumber?: string;
  issueDate?: string;
  docPhotoUrl?: string;
  createdAt: string;
}

interface DocumentViewerProps {
  document: VerificationDocument;
  showStatus?: boolean;
}

export function DocumentViewer({ document, showStatus = true }: DocumentViewerProps) {
  const [selectedImage, setSelectedImage] = useState<{ url: string; type: string } | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      {showStatus && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Badge className={cn("text-xs capitalize", getStatusColor(document.status))}>
            {document.status}
          </Badge>
        </div>
      )}

      {/* Document Details */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Document Type</p>
            <p className="font-semibold capitalize">{document.docType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Submitted</p>
            <p className="font-semibold text-sm">
              {new Date(document.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {document.fullNameCitizenship && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Full Name (From Document)</p>
            <p className="font-semibold">{document.fullNameCitizenship}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {document.citizenshipNumber && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Citizenship Number</p>
              <p className="font-mono text-sm">{document.citizenshipNumber}</p>
            </div>
          )}
          {document.dateOfBirth && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Date of Birth</p>
              <p className="font-semibold text-sm">{document.dateOfBirth}</p>
            </div>
          )}
        </div>

        {document.issueDate && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Issue Date</p>
            <p className="font-semibold text-sm">{document.issueDate}</p>
          </div>
        )}
      </div>

      {/* Document Images */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Submitted Documents</p>
        <div className="grid grid-cols-2 gap-3">
          {/* ID/Citizenship Document */}
          {document.docPhotoUrl && (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  onClick={() => setSelectedImage({ url: document.docPhotoUrl || "", type: "ID Document" })}
                  className="relative group overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
                >
                  <img
                    src={getMediaUrl(document.docPhotoUrl) || document.docPhotoUrl}
                    alt="ID Document"
                    className="w-full h-32 object-cover opacity-75 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                    <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white font-medium">ID/Citizenship</p>
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>ID/Citizenship Document</DialogTitle>
                </DialogHeader>
                <img
                  src={getMediaUrl(document.docPhotoUrl) || document.docPhotoUrl}
                  alt="ID Document"
                  className="w-full rounded-lg"
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Selfie */}
          {document.selfieUrl && (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  onClick={() => setSelectedImage({ url: document.selfieUrl || "", type: "Selfie" })}
                  className="relative group overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
                >
                  <img
                    src={getMediaUrl(document.selfieUrl) || document.selfieUrl}
                    alt="Selfie"
                    className="w-full h-32 object-cover opacity-75 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                    <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white font-medium">Selfie</p>
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Verification Selfie</DialogTitle>
                </DialogHeader>
                <img
                  src={getMediaUrl(document.selfieUrl) || document.selfieUrl}
                  alt="Selfie"
                  className="w-full rounded-lg"
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}
