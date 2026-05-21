import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Eye, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateContractPDF } from "@/lib/pdf-generator";

interface ContractViewerProps {
  contract: {
    id: number;
    matchId: number;
    tenant?: { firstName: string; lastName?: string };
    owner?: { firstName: string; lastName?: string };
    room?: { id?: number; title: string; city: string; address: string };
    rentAmount: number;
    tenantPaymentStatus?: string;
    tenantPaymentReference?: string | null;
    tenantSignedAt?: string | null;
    ownerSignedAt?: string | null;
    ownerSignature?: string | null;
    tenantSignature?: string | null;
    status: string;
    startDate: string;
    endDate: string;
    terms?: string | null;
    createdAt: string;
    contractPdfUrl?: string | null;
  };
}

export function ContractViewer({ contract }: ContractViewerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingStored, setIsDownloadingStored] = useState(false);

  const tenantName = contract.tenant
    ? `${contract.tenant.firstName} ${contract.tenant.lastName || ""}`.trim()
    : "Tenant";

  const ownerName = contract.owner
    ? `${contract.owner.firstName} ${contract.owner.lastName || ""}`.trim()
    : "Owner";

  const roomName = contract.room && contract.room.title
    ? `${contract.room.title} (${contract.room.city})`
    : "Room #N/A";

  const tenantSigDisplay = contract.tenantSignature
    ? (contract.tenantSignature.startsWith("data:image")
      ? <img src={contract.tenantSignature} alt="Tenant signature" className="max-w-[130px] max-h-[70px] object-contain" />
      : <div className="text-sm font-semibold">{contract.tenantSignature}</div>)
    : <div className="h-[60px] border-b border-gray-300"></div>;

  const ownerSigDisplay = contract.ownerSignature
    ? (contract.ownerSignature.startsWith("data:image")
      ? <img src={contract.ownerSignature} alt="Owner signature" className="max-w-[130px] max-h-[70px] object-contain" />
      : <div className="text-sm font-semibold">{contract.ownerSignature}</div>)
    : <div className="h-[60px] border-b border-gray-300"></div>;

  const handleDownloadStoredPDF = async () => {
    if (!contract.contractPdfUrl) return;
    setIsDownloadingStored(true);
    try {
      const response = await fetch(
        `/api/storage/download?path=${encodeURIComponent(contract.contractPdfUrl)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("ghar_khoj_jwt")}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `contract-${contract.id}-signed.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Failed to download PDF. Please try again.");
    } finally {
      setIsDownloadingStored(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);

    try {
      const blob = await generateContractPDF(contract);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `contract-${contract.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate and download PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2 rounded-xl">
          <Eye size={16} />
          View Contract Document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="text-center border-b pb-4">
          <DialogTitle className="text-3xl font-bold mb-2">RENTAL AGREEMENT</DialogTitle>
          <DialogDescription className="text-gray-600">Property Rental Contract</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-muted/50 p-4">
          <div className="bg-white p-8 space-y-6 max-w-3xl mx-auto">

            {/* Logo / Stamp Area */}
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="text-xs text-gray-500">Contract ID: {contract.id}</p>
                <p className="text-xs text-gray-500">
                  Created: {new Date(contract.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <img
                  src="/images/chatgpt.png"
                  alt="Ghar Khoj logo"
                  className="w-24 h-24 object-contain"
                />
              </div>
            </div>

            {/* Parties Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800">PARTIES TO AGREEMENT</h2>

              <div className="grid grid-cols-2 gap-8">
                <div className="border p-4 rounded">
                  <p className="font-bold text-sm mb-3 text-primary">TENANT:</p>
                  <p className="text-sm font-semibold">{tenantName}</p>
                  <p className="text-xs text-gray-600 mt-2">Role: Tenant / Renter</p>
                </div>

                <div className="border p-4 rounded">
                  <p className="font-bold text-sm mb-3 text-primary">OWNER/LANDLORD:</p>
                  <p className="text-sm font-semibold">{ownerName}</p>
                  <p className="text-xs text-gray-600 mt-2">Role: Property Owner / Landlord</p>
                </div>
              </div>
            </div>

            {/* Property Details */}
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-gray-800">PROPERTY DETAILS</h2>
              <div className="border p-4 rounded space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Property Name</p>
                    <p className="font-semibold text-sm">{contract.room?.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Location</p>
                    <p className="font-semibold text-sm">
                      {contract.room?.city}, {contract.room?.address}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Terms */}
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-gray-800">FINANCIAL TERMS</h2>
              <div className="border p-4 rounded space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Monthly Rent Amount</p>
                    <p className="font-bold text-lg">
                      NPR {contract.rentAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Payment Frequency</p>
                    <p className="font-semibold text-sm">Monthly (Due on 1st)</p>
                  </div>
                </div>
                {contract.tenantPaymentStatus && (
                  <div className={contract.tenantPaymentStatus === "paid" ? "rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800" : "rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800"}>
                    <p className="font-semibold">Khalti Payment</p>
                    <p>{contract.tenantPaymentStatus === "paid" ? "Payment received via Khalti." : "Payment pending via Khalti."}</p>
                    {contract.tenantPaymentReference && <p className="text-xs text-muted-foreground">Reference: {contract.tenantPaymentReference}</p>}
                  </div>
                )}
                <div className={contract.tenantPaymentStatus === "paid" ? "rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800" : "rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800"}>
                  <p className="font-semibold">Signing Commission</p>
                  <p>{contract.tenantPaymentStatus === "paid"
                    ? "NPR 100 has been paid as commission to Ghar KHOJ."
                    : "Tenant should pay a minimum commission of NPR 100 to Ghar KHOJ before signing."}
                  </p>
                </div>
              </div>
            </div>

            {/* Term of Lease */}
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-gray-800">TERM OF LEASE</h2>
              <div className="border p-4 rounded">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Move-in Date (Start)</p>
                    <p className="font-semibold text-sm">{contract.startDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Move-out Date (End)</p>
                    <p className="font-semibold text-sm">{contract.endDate}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            {contract.terms && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-gray-800">SPECIAL TERMS & CONDITIONS</h2>
                <div className="border p-4 rounded bg-gray-50">
                  <p className="text-sm whitespace-pre-wrap">{contract.terms}</p>
                </div>
              </div>
            )}

            {/* Default Terms */}
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-gray-800">STANDARD TERMS</h2>
              <div className="border p-4 rounded space-y-3 text-sm">
                <p>
                  <span className="font-semibold">1. Rent Payment:</span> The tenant
                  agrees to pay the monthly rent amount on or before the 1st of each
                  month to the owner's specified account.
                </p>
                <p>
                  <span className="font-semibold">2. Property Maintenance:</span> The tenant
                  agrees to maintain the property in good condition and report any
                  repairs or damages needed to the owner immediately.
                </p>
                <p>
                  <span className="font-semibold">3. Security Deposit:</span> A
                  security deposit equivalent to one month's rent will be held by the owner
                  and returned upon lease termination after property inspection.
                </p>
                <p>
                  <span className="font-semibold">4. Lease Termination:</span> Either party
                  may terminate this agreement by providing 30 days written notice
                  in advance.
                </p>
                <p>
                  <span className="font-semibold">5. Utilities & Services:</span> The tenant
                  is responsible for paying all utility bills (electricity, water, gas, etc.)
                  unless otherwise agreed upon in writing.
                </p>
                <p>
                  <span className="font-semibold">6. Jurisdiction:</span> This
                  agreement is governed by the laws of Nepal and both parties agree to
                  submit to the jurisdiction of courts in {contract.room?.city || "the specified city"}.
                </p>
              </div>
            </div>

            {/* Signatures */}
            <div className="space-y-6 pt-6 border-t">
              <p className="text-sm text-gray-600 font-semibold">
                DIGITAL SIGNATURES OF THE PARTIES:
              </p>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="min-h-[90px] rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-center justify-center">
                    {tenantSigDisplay}
                  </div>
                  <p className="text-sm font-semibold">{tenantName}</p>
                  <p className="text-xs text-gray-600">Tenant's Signature</p>
                  <p className="text-xs text-gray-600">Date: {contract.tenantSignedAt ? new Date(contract.tenantSignedAt).toLocaleDateString("en-NP") : "Pending"}</p>
                </div>

                <div className="space-y-3">
                  <div className="min-h-[90px] rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-center justify-center">
                    {ownerSigDisplay}
                  </div>
                  <p className="text-sm font-semibold">{ownerName}</p>
                  <p className="text-xs text-gray-600">Owner's Signature</p>
                  <p className="text-xs text-gray-600">Date: {contract.ownerSignedAt ? new Date(contract.ownerSignedAt).toLocaleDateString("en-NP") : "Pending"}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-400 pt-4 border-t">
              <p className="font-semibold text-gray-600 mb-1">
                Ghar Khoj - Room Rental Nepal
              </p>
              <p>
                Official Rental Agreement Contract
              </p>
              <p className="mt-1">Generated: {new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t bg-background shrink-0 flex-wrap">
          {contract.contractPdfUrl && (
            <Button
              onClick={handleDownloadStoredPDF}
              disabled={isDownloadingStored}
              variant="outline"
              className="gap-2 rounded-xl"
            >
              {isDownloadingStored ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {isDownloadingStored ? "Downloading..." : "Download Signed PDF"}
            </Button>
          )}
          <Button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="gap-2 rounded-xl"
          >
            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isDownloading ? "Generating..." : "Generate New PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
