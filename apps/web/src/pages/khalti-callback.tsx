import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function KhaltiCallbackPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "pending" | "error">("loading");
  const [message, setMessage] = useState("Verifying your Khalti payment...");
  const [contractId, setContractId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchaseOrderId = params.get("purchase_order_id");
    const pidx = params.get("pidx");
    const statusParam = params.get("status") || "";

    if (!purchaseOrderId || !pidx) {
      setStatus("error");
      setMessage("Missing Khalti payment callback data. Please return to the contracts page and try again.");
      return;
    }

    const match = purchaseOrderId.match(/^contract-(\d+)$/);
    if (!match) {
      setStatus("error");
      setMessage("Unable to identify the contract associated with this payment.");
      return;
    }

    const id = Number(match[1]);
    setContractId(id);

    const hasStatus = typeof statusParam === "string" && statusParam.trim().length > 0;
    if (hasStatus && statusParam.toLowerCase() !== "completed") {
      setStatus("error");
      setMessage(`Payment status returned: ${statusParam}. Please return to the contract and try again.`);
      setTimeout(() => setLocation("/contracts"), 4000);
      return;
    }

    const verifyPayment = async () => {
      try {
        const response = await customFetch<{ success: boolean; message: string }>(`/api/contracts/${id}/khalti/verify`, {
          method: "POST",
          body: JSON.stringify({ pidx }),
        });

        if (response.success) {
          setStatus("success");
          setMessage(response.message || "Payment successful! Contract signed.");
          toast({ title: "Payment confirmed", description: response.message || "Khalti payment has been verified.", variant: "success" });
          setTimeout(() => setLocation(`/contracts/${id}`), 3500);
        } else {
          setStatus("error");
          setMessage(response.message || "Payment not completed. Please return to the contract.");
          toast({ title: "Payment verification failed", description: response.message || "Payment not completed.", variant: "destructive" });
          setTimeout(() => setLocation(`/contracts/${id}`), 4000);
        }
      } catch (error: any) {
        console.error("Khalti callback verify failed:", error);
        const fallback = statusParam ? `Payment status returned: ${statusParam}` : "Unable to verify payment status.";
        setStatus("error");
        setMessage(error?.message ? `${error.message}. ${fallback}` : `Payment verification failed. ${fallback}`);
        toast({ title: "Payment verification failed", description: fallback, variant: "destructive" });
        setTimeout(() => setLocation(`/contracts/${id}`), 4000);
      }
    };

    verifyPayment();
  }, [toast, setLocation]);

  return (
    <div className="max-w-2xl mx-auto py-20 px-6">
      <BackButton fallback="/contracts" label="Back to Contracts" className="mb-6" />
      <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
        {status === "loading" ? (
          <div className="space-y-4">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold">Verifying payment</h1>
            <p className="text-muted-foreground">We are confirming your Khalti transaction. Please wait a moment.</p>
          </div>
        ) : status === "success" ? (
          <div className="space-y-4">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">Payment confirmed</h1>
            <p className="text-muted-foreground">{message}</p>
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-center">
              <Button onClick={() => setLocation("/contracts")}>Go to Contracts</Button>
              {contractId && (
                <Button variant="outline" onClick={() => setLocation(`/contracts/${contractId}`)}>
                  Go to Contract
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-700">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">Payment verification failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-center">
              <Button variant="outline" onClick={() => setLocation("/contracts")}>Back to Contracts</Button>
              {contractId && (
                <Button onClick={() => setLocation(`/contracts`)}>Retry in Contracts</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
