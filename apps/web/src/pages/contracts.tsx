import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth, isRealUserLoggedIn } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  FileText, CheckCircle2, Clock, XCircle, PenLine,
  Lock, ShieldCheck, ArrowLeft, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { format } from "date-fns";
import { BackButton } from "@/components/back-button";
import { ContractViewer } from "@/components/contract-viewer";
import { customFetch } from "@workspace/api-client-react";
import { SignaturePad } from "@/components/signature-pad";
import { generateContractPDF } from "@/lib/pdf-generator";

const KHALTI_PAYMENT_AMOUNT = 100;

interface Contract {
  id: number; matchId: number; tenantId: number; ownerId: number; roomId: number;
  rentAmount: number; startDate: string; endDate: string; terms?: string;
  tenantPaymentStatus?: string; tenantPaymentReference?: string | null; tenantPaymentVerifiedAt?: string | null;
  ownerSignature?: string; tenantSignature?: string;
  ownerSignedAt?: string; tenantSignedAt?: string;
  status: string; adminVerifiedAt?: string; adminNote?: string; createdAt: string;
  contractPdfUrl?: string;
  tenant?: { id: number; firstName: string; lastName?: string };
  owner?: { id: number; firstName: string; lastName?: string };
  room?: { id: number; title: string; city: string; address: string };
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  pending_payment: { label: "Pending Payment", color: "bg-amber-100 text-amber-700", icon: Clock },
  payment_received: { label: "Payment Received", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  owner_signed: { label: "Owner Signed", color: "bg-blue-100 text-blue-700", icon: PenLine },
  tenant_signed: { label: "Tenant Signed", color: "bg-blue-100 text-blue-700", icon: PenLine },
  signed: { label: "Signed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  fully_signed: { label: "Fully Signed", color: "bg-amber-100 text-amber-700", icon: CheckCircle2 },
  verified: { label: "Verified", color: "bg-green-100 text-green-700", icon: ShieldCheck },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
};

function ContractCard({ contract, userId, onPay, onSign, onViewDetail, paymentLoading, payingId }: {
  contract: Contract; userId: number | null;
  onPay: (id: number) => void;
  onSign: (contract: Contract, role: string) => void;
  onViewDetail: (id: number) => void;
  paymentLoading: boolean;
  payingId: number | null;
}) {
  const isOwner = contract.ownerId === userId;
  const isTenant = contract.tenantId === userId;
  const effectiveStatus = contract.status === "pending_payment" && contract.tenantPaymentStatus === "paid"
    ? "payment_received"
    : contract.status;
  const status = STATUS_MAP[effectiveStatus] || STATUS_MAP.draft;
  const StatusIcon = status.icon;

  const isPaid = contract.tenantPaymentStatus === "paid";
  const needsPayment = isTenant && !isPaid && !["cancelled", "verified", "fully_signed"].includes(contract.status);
  const canTenantSign = isTenant && isPaid && !contract.tenantSignature && !["cancelled", "verified", "fully_signed"].includes(contract.status);
  const canOwnerSign = isOwner && !contract.ownerSignature && !["cancelled", "verified", "fully_signed"].includes(contract.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-base line-clamp-1">{contract.room?.title || `Room #${contract.roomId}`}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{contract.room?.city} · {contract.room?.address}</p>
        </div>
        <Badge className={cn("text-xs font-medium", status.color)}>
          <StatusIcon size={11} className="mr-1" /> {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-muted/30 rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Monthly Rent</p>
          <p className="font-bold text-foreground">NPR {contract.rentAmount.toLocaleString()}</p>
        </div>
        <div className="bg-muted/30 rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Period</p>
          <p className="font-bold text-foreground text-xs">{contract.startDate} → {contract.endDate}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs mb-3">
        <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full", contract.ownerSignature ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
          <CheckCircle2 size={10} /> Owner {contract.ownerSignature ? "signed" : "pending"}
        </div>
        <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full", contract.tenantSignature ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
          <CheckCircle2 size={10} /> Tenant {contract.tenantSignature ? "signed" : "pending"}
        </div>
        <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full", isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
          <CheckCircle2 size={10} /> {isPaid ? "Khalti paid" : "Khalti pending"}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs h-9" onClick={() => onViewDetail(contract.id)}>
            View Contract
          </Button>
        </div>
        {needsPayment ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <Button
                size="sm"
                className="flex-1 rounded-xl text-xs h-9"
                onClick={() => onPay(contract.id)}
                disabled={paymentLoading && payingId === contract.id}
              >
                {paymentLoading && payingId === contract.id ? "Processing..." : "Pay Rs. 100 & Sign Contract"}
              </Button>
              <p className="text-xs text-amber-700">Payment required before tenant signing.</p>
            </div>
          </div>
        ) : (canTenantSign || canOwnerSign) ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <Button
                size="sm"
                className="flex-1 rounded-xl text-xs h-9"
                onClick={() => onSign(contract, canTenantSign ? "tenant" : "owner")}
              >
                {canTenantSign ? "Sign Contract" : "Sign as Owner"}
              </Button>
            </div>
            <p className="text-xs text-emerald-700">
              {canTenantSign ? "Payment received. Please sign the contract." : "Please sign this contract to complete the agreement."}
            </p>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function SignModal({ contract, role, onClose, onSigned }: {
  contract: Contract; role: string;
  onClose: () => void; onSigned: () => void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSign = async () => {
    if (!signature) return;
    setLoading(true);
    try {
      await customFetch(`/api/contracts/${contract.id}/sign`, {
        method: "PATCH",
        body: JSON.stringify({ role, signature }),
      });

      const contractData = await customFetch(`/api/contracts/${contract.id}`);
      if (contractData?.status === "fully_signed") {
        try {
          const pdfBlob = await generateContractPDF(contractData);
          const uploadUrlRes = await customFetch(`/api/contracts/${contract.id}/pdf-upload-url`, {
            method: "POST",
          });
          if (!uploadUrlRes?.uploadUrl) throw new Error("Failed to get upload URL");
          const uploadRes = await fetch(uploadUrlRes.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: pdfBlob,
          });
          if (!uploadRes.ok) throw new Error("Failed to upload PDF");
          const objectPath = uploadUrlRes.uploadUrl.includes("/api/storage/local-upload/")
            ? `/objects/local/${uploadUrlRes.uploadUrl.split("/").pop()}`
            : uploadUrlRes.uploadUrl;
          await customFetch(`/api/contracts/${contract.id}/pdf-store-url`, {
            method: "POST",
            body: JSON.stringify({ objectPath }),
          });
        } catch (pdfErr) {
          console.error("PDF generation/upload error:", pdfErr);
        }
      }

      toast({ title: "Contract signed successfully!" });
      onSigned();
    } catch (err) {
      console.error("Signing error:", err);
      toast({ title: "Signing failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><PenLine size={18} /> Sign This Contract</h3>
        <p className="text-sm text-muted-foreground mb-4">Sign this contract to confirm your agreement. A PDF will be generated and stored for all parties.</p>

        <div className="space-y-4">
          <SignaturePad mode="typed" onSignatureCapture={setSignature} />

          {signature && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-sm text-green-700 font-medium">✓ Signature captured: {signature}</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            By signing, you agree to be legally bound by this rental contract. A PDF will be generated and stored.
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-lg" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button className="flex-1 rounded-lg gap-2" disabled={!signature || loading} onClick={handleSign}>
              {loading ? (<><Loader2 size={14} className="animate-spin" /> Signing...</>) : (<><PenLine size={14} /> Confirm & Sign</>) }
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ContractDetail({ id, onBack, userId, onRequestSign }: {
  id: number; onBack: () => void; userId: number | null;
  onRequestSign: (contract: Contract, role: string) => void;
}) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadContract = async () => {
      try {
        const data = await customFetch(`/api/contracts/${id}`);
        setContract(data || null);
      } catch (err) {
        console.error("Error loading contract:", err);
      } finally {
        setLoading(false);
      }
    };
    loadContract();
  }, [id]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  if (!contract) return <div className="text-center py-12 text-muted-foreground">Contract not found</div>;

  const isPaid = contract.tenantPaymentStatus === "paid";
  const effectiveStatus = contract.status === "pending_payment" && isPaid ? "payment_received" : contract.status;
  const status = STATUS_MAP[effectiveStatus] || STATUS_MAP.draft;
  const StatusIcon = status.icon;
  const isTenant = userId !== null && contract.tenantId === userId;
  const isOwner = userId !== null && contract.ownerId === userId;
  const canTenantSign = isTenant && isPaid && !contract.tenantSignature && !["cancelled", "verified", "fully_signed"].includes(contract.status);
  const canOwnerSign = isOwner && !contract.ownerSignature && !["cancelled", "verified", "fully_signed"].includes(contract.status);

  return (
    <div className="max-w-2xl mx-auto">
      {(canTenantSign || canOwnerSign || (isTenant && !isPaid)) && (
        <div className="mb-6 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          {canTenantSign || canOwnerSign ? (
            <>
              <p className="text-sm font-semibold">Contract signing action</p>
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => onRequestSign(contract, canTenantSign ? "tenant" : "owner")}
              >
                {canTenantSign ? "Sign Contract" : "Sign as Owner"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-amber-700">
              Please complete the payment of NPR 100 before signing this contract.
            </p>
          )}
        </div>
      )}
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm font-medium transition-colors">
        <ArrowLeft size={16} /> Back to Contracts
      </button>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-secondary to-blue-700 p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-bold text-lg">
              <FileText size={20} /> Rental Contract #{contract.id}
            </div>
            <span className={cn("text-xs font-bold px-3 py-1 rounded-full", status.color)}>
              <StatusIcon size={11} className="inline mr-1" />{status.label}
            </span>
          </div>
          <p className="text-sm text-white/80">This page only provides access to the official rental agreement document.</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-3">
            <ContractViewer contract={contract} />
          </div>
        </div>
      </div>
      
    </div>
  );
}

export default function ContractsPage() {
  const { userId, isVerified, isAdmin } = useAuth();
  const [, params] = useRoute("/contracts/:id");
  const [, setLocation] = useLocation();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const viewingId = params?.id ? Number(params.id) : null;
  const [signingContract, setSigningContract] = useState<Contract | null>(null);
  const [signingRole, setSigningRole] = useState<string>("");
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  const { toast } = useToast();

  const fetchContracts = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await customFetch(`/api/contracts/user/${userId}`);
      setContracts(data?.contracts || []);
    } catch (err) {
      console.error("Error fetching contracts:", err);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContracts(); }, [userId]);

  const handleSign = (contract: Contract, role: string) => {
    setSigningContract(contract);
    setSigningRole(role);
  };

  const handlePay = async (contractId: number) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) {
      toast({ title: "Contract missing", description: "Unable to find contract for payment.", variant: "destructive" });
      return;
    }

    setPayingId(contractId);
    setPaymentLoading(true);

    try {
      const response = await customFetch<{ paymentUrl: string }>(`/api/contracts/${contract.id}/khalti/initiate`, {
        method: "POST",
      });

      if (!response?.paymentUrl) {
        throw new Error("Missing payment URL from Khalti initiation response.");
      }

      window.location.href = response.paymentUrl;
    } catch (err: any) {
      console.error("Khalti payment initiation failed:", err);
      toast({ title: "Payment error", description: err?.message || "Unable to initiate Khalti payment.", variant: "destructive" });
      setPaymentLoading(false);
      setPayingId(null);
    }
  };

  if (!isRealUserLoggedIn()) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 bg-white rounded-3xl border shadow-xl px-6 mt-10">
        <Lock size={48} className="text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
        <p className="text-muted-foreground mb-6">You need to be logged in to view contracts.</p>
        <Link href="/login"><Button className="rounded-xl">Sign In</Button></Link>
      </div>
    );
  }

  if (!isVerified && !isAdmin) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 bg-white rounded-3xl border shadow-xl px-6 mt-10">
        <BackButton fallback="/" label="Back" className="mb-6" />
        <Lock size={48} className="text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Identity Verification Required</h2>
        <p className="text-muted-foreground mb-6">You must verify your identity to access and manage rental contracts.</p>
        <Link href="/verification"><Button className="rounded-xl">Verify Identity to Continue</Button></Link>
      </div>
    );
  }

  if (viewingId !== null) {
    return (
      <ContractDetail
        id={viewingId}
        onBack={() => setLocation("/contracts")}
        userId={userId}
        onRequestSign={handleSign}
      />
    );
  }

  const active = contracts.filter(c => !["cancelled"].includes(c.status));
  const cancelled = contracts.filter(c => c.status === "cancelled");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Back
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <FileText className="text-primary" size={24} /> My Contracts
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your rental agreements and their signing status</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : active.length === 0 && cancelled.length === 0 ? (
        <div className="bg-white rounded-3xl border shadow-sm p-16 text-center">
          <FileText size={48} className="text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No contracts yet</h2>
          <p className="text-muted-foreground text-sm">
            Contracts are created when a match is accepted by both parties.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Active ({active.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.map(c => (
                  <ContractCard
                    key={c.id}
                    contract={c}
                    userId={userId}
                    onPay={handlePay}
                    onSign={handleSign}
                    onViewDetail={(id) => setLocation(`/contracts/${id}`)}
                    paymentLoading={paymentLoading}
                    payingId={payingId}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {signingContract && (
        <SignModal
          contract={signingContract}
          role={signingRole}
          onClose={() => setSigningContract(null)}
          onSigned={() => { setSigningContract(null); fetchContracts(); }}
        />
      )}
    </div>
  );
}
