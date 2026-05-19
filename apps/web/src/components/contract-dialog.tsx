import { useEffect, useState } from "react";
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
  const [matchRoomPrice, setMatchRoomPrice] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    rentAmount: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    terms: "",
  });

  useEffect(() => {
    if (!open) return;

    const loadMatchDetails = async () => {
      try {
        const matchData = await customFetch(
          `/api/matches/participants/${tenantId}/${ownerId}`
        );

        if (matchData?.room?.price) {
          setMatchRoomPrice(matchData.room.price);
          setFormData((prev) => ({
            ...prev,
            rentAmount: matchData.room.price.toString(),
          }));
        }
      } catch (error) {
        console.warn("Unable to prefill contract fields from match details", error);
      }
    };

    loadMatchDetails();
  }, [open, tenantId, ownerId]);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.rentAmount || !formData.startDate || !formData.endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const rentAmount = parseInt(formData.rentAmount);
    if (isNaN(rentAmount) || rentAmount <= 0) {
      toast({
        title: "Invalid Rent Amount",
        description: "Rent amount must be a positive number",
        variant: "destructive",
      });
      return;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      toast({
        title: "Invalid Start Date",
        description: "Start date cannot be in the past",
        variant: "destructive",
      });
      return;
    }

    if (endDate <= startDate) {
      toast({
        title: "Invalid End Date",
        description: "End date must be after the start date",
        variant: "destructive",
      });
      return;
    }

    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
    if (monthsDiff < 1) {
      toast({
        title: "Invalid Contract Duration",
        description: "Contract must be for at least 1 month",
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

      // Create contract using the room's posted price
      const contractResponse = await customFetch("/api/contracts", {
        method: "POST",
        body: JSON.stringify({
          matchId: matchData.id,
          tenantId,
          ownerId,
          roomId: matchData.roomId,
          rentAmount: matchData.room?.price,
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
            <Input value={`${tenantName} (Tenant)`} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Owner/Landlord Name</Label>
            <Input value={`${ownerName} (Owner/Landlord)`} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Monthly Rent Amount (NPR)</Label>
            {matchRoomPrice !== null ? (
              <Input
                value={matchRoomPrice.toString()}
                disabled
                className="bg-muted"
              />
            ) : (
              <Input
                id="rentAmount"
                type="number"
                placeholder="e.g., 15000"
                min="1"
                step="1"
                value={formData.rentAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) {
                    setFormData({ ...formData, rentAmount: val });
                  }
                }}
                required
              />
            )}
            <p className="text-xs text-muted-foreground">
              The contract rent uses the room's posted price.
            </p>
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
                disabled
                required
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Start date is fixed for both parties and set to today.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                min={formData.startDate}
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Default contract length is 12 months, but you may adjust if needed.
              </p>
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
