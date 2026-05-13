import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2 } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";

interface ContractDialogProps {
  tenantId: number;
  ownerId: number;
  tenantName: string;
  ownerName: string;
  onContractCreated?: (contractId: number) => void;
}

export function ContractDialog({
  tenantId,
  ownerId,
  tenantName,
  ownerName,
  onContractCreated,
}: ContractDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    rentAmount: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    terms: "",
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rentAmount || !formData.startDate || !formData.endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch match details first
      const matchData = await customFetch(
        `/api/matches/participants/${tenantId}/${ownerId}`
      );

      if (!matchData) {
        toast({
          title: "Error",
          description: "Could not find match between these users",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Create contract
      const contractResponse = await customFetch("/api/contracts", {
        method: "POST",
        body: JSON.stringify({
          matchId: matchData.id,
          tenantId,
          ownerId,
          roomId: matchData.roomId,
          rentAmount: parseInt(formData.rentAmount),
          startDate: formData.startDate,
          endDate: formData.endDate,
          terms: formData.terms,
        }),
      });

      if (contractResponse) {
        toast({
          title: "Success",
          description: "Contract created successfully",
        });
        setOpen(false);
        onContractCreated?.(contractResponse.id);
        // Reset form
        setFormData({
          rentAmount: "",
          startDate: new Date().toISOString().split("T")[0],
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          terms: "",
        });
      }
    } catch (error: any) {
      console.error("Contract creation error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create contract",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          title="Create rental contract"
        >
          <FileText size={16} />
          <span className="hidden sm:inline">Contract</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Rental Contract</DialogTitle>
          <DialogDescription>
            Create a formal rental agreement between {tenantName} (Tenant) and{" "}
            {ownerName} (Owner)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tenant Name</Label>
            <Input value={tenantName} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Owner Name</Label>
            <Input value={ownerName} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rentAmount">
              Monthly Rent Amount (NPR) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="rentAmount"
              type="number"
              placeholder="e.g., 15000"
              value={formData.rentAmount}
              onChange={(e) =>
                setFormData({ ...formData, rentAmount: e.target.value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="terms">Additional Terms (Optional)</Label>
            <Textarea
              id="terms"
              placeholder="e.g., Security deposit details, maintenance responsibilities, etc."
              value={formData.terms}
              onChange={(e) =>
                setFormData({ ...formData, terms: e.target.value })
              }
              className="min-h-24"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Contract"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
