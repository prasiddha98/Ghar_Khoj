import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Eye, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import html2pdf from "html2pdf.js";

interface ContractViewerProps {
  contract: {
    id: number;
    matchId: number;
    tenant?: { firstName: string; lastName?: string };
    owner?: { firstName: string; lastName?: string };
    room?: { title: string; city: string; address: string };
    rentAmount: number;
    startDate: string;
    endDate: string;
    terms?: string;
    createdAt: string;
  };
}

export function ContractViewer({ contract }: ContractViewerProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const tenantName = contract.tenant
    ? `${contract.tenant.firstName} ${contract.tenant.lastName || ""}`.trim()
    : "Tenant";

  const ownerName = contract.owner
    ? `${contract.owner.firstName} ${contract.owner.lastName || ""}`.trim()
    : "Owner";

  const roomName = contract.room
    ? `${contract.room.title} (${contract.room.city})`
    : `Room #${contract.room?.id || "N/A"}`;

  const handleDownloadPDF = () => {
    const element = printRef.current;
    if (!element) return;

    const opt = {
      margin: 10,
      filename: `contract-${contract.id}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
    };

    html2pdf().set(opt).from(element).save();
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Eye size={16} />
          View Contract
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Rental Contract #{contract.id}</DialogTitle>
          <DialogDescription>
            Contract between {tenantName} and {ownerName}
          </DialogDescription>
        </DialogHeader>

        <div ref={printRef} className="bg-white p-8 space-y-6">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h1 className="text-3xl font-bold mb-2">RENTAL AGREEMENT</h1>
            <p className="text-gray-600">Property Rental Contract</p>
          </div>

          {/* Logo / Stamp Area */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500">Contract ID: {contract.id}</p>
              <p className="text-xs text-gray-500">
                Date: {currentDate}
              </p>
            </div>
            <div className="text-right">
              <div className="w-24 h-24 border-2 border-primary rounded-full flex items-center justify-center text-center">
                <div className="text-xs font-bold text-primary">GHAR KHOJ</div>
              </div>
            </div>
          </div>

          {/* Parties Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">PARTIES TO AGREEMENT</h2>

            <div className="grid grid-cols-2 gap-8">
              <div className="border p-4 rounded">
                <p className="font-bold text-sm mb-3">TENANT:</p>
                <p className="text-sm font-semibold">{tenantName}</p>
                <p className="text-xs text-gray-600 mt-2">Role: Tenant</p>
              </div>

              <div className="border p-4 rounded">
                <p className="font-bold text-sm mb-3">OWNER/LANDLORD:</p>
                <p className="text-sm font-semibold">{ownerName}</p>
                <p className="text-xs text-gray-600 mt-2">Role: Property Owner</p>
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
            <div className="border p-4 rounded">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Monthly Rent Amount</p>
                  <p className="font-bold text-lg">
                    NPR {contract.rentAmount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Payment Frequency</p>
                  <p className="font-semibold text-sm">Monthly</p>
                </div>
              </div>
            </div>
          </div>

          {/* Term of Lease */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-gray-800">TERM OF LEASE</h2>
            <div className="border p-4 rounded">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Start Date</p>
                  <p className="font-semibold text-sm">{contract.startDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">End Date</p>
                  <p className="font-semibold text-sm">{contract.endDate}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          {contract.terms && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-gray-800">TERMS & CONDITIONS</h2>
              <div className="border p-4 rounded bg-gray-50">
                <p className="text-sm whitespace-pre-wrap">{contract.terms}</p>
              </div>
            </div>
          )}

          {/* Default Terms */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-gray-800">DEFAULT TERMS</h2>
            <div className="border p-4 rounded space-y-2 text-sm">
              <p>
                <span className="font-semibold">1. Rent Payment:</span> The tenant
                agrees to pay the monthly rent amount on or before the first day of
                each month.
              </p>
              <p>
                <span className="font-semibold">2. Maintenance:</span> The tenant
                agrees to maintain the property in good condition and report any
                repairs needed to the owner immediately.
              </p>
              <p>
                <span className="font-semibold">3. Security Deposit:</span> A
                security deposit equivalent to one month's rent may be collected at
                the beginning of the tenancy.
              </p>
              <p>
                <span className="font-semibold">4. Termination:</span> Either party
                may terminate this agreement by providing 30 days written notice.
              </p>
              <p>
                <span className="font-semibold">5. Jurisdiction:</span> This
                agreement is governed by the laws of Nepal and both parties agree to
                submit to the jurisdiction of the courts in the specified city.
              </p>
            </div>
          </div>

          {/* Signatures */}
          <div className="space-y-6 pt-6 border-t">
            <p className="text-sm text-gray-600 font-semibold">
              SIGNATURES OF THE PARTIES:
            </p>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-8">
                <div className="h-20 border-b border-gray-400"></div>
                <p className="text-sm font-semibold">{tenantName}</p>
                <p className="text-xs text-gray-600">Tenant's Signature</p>
                <p className="text-xs text-gray-600">Date: _______________</p>
              </div>

              <div className="space-y-8">
                <div className="h-20 border-b border-gray-400"></div>
                <p className="text-sm font-semibold">{ownerName}</p>
                <p className="text-xs text-gray-600">Owner's Signature</p>
                <p className="text-xs text-gray-600">Date: _______________</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 pt-4 border-t">
            <p>
              This is a digitally generated contract from Ghar Khoj - Room Rental
              Nepal
            </p>
            <p>Contract Date: {currentDate}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button
            onClick={handleDownloadPDF}
            className="gap-2"
          >
            <Download size={16} />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
