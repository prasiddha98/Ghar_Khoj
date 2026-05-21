import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Home, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { customFetch } from "@/lib/customFetch";

const NEPAL_CITIES = ["Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Biratnagar", "Birgunj", "Dharan", "Butwal", "Hetauda", "Nepalgunj"];

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<"tenant" | "owner">("tenant");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [preferredCity, setPreferredCity] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName.trim() || !email.trim() || !password) {
      toast({ title: "Fill in required fields", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const data = await customFetch<{ message: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ firstName, lastName, email, phone, password, role, preferredCity }),
      });
      
      toast({ title: "Account created!", description: "Please sign in to continue." });
      setLocation("/login");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003893]/5 to-[#DC143C]/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2 mb-4">
              <img
                src="/images/chatgpt.png"
                alt="logo"
                className="w-10 h-10 rounded-xl object-cover"
              />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="text-muted-foreground mt-1 text-sm">Join thousands renting directly — no brokers</p>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">
          {/* Role selection */}
          <div>
            <p className="text-sm font-semibold mb-3 text-foreground">I am looking to</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRole("tenant")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  role === "tenant" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                )}
              >
                <Home size={24} className={role === "tenant" ? "text-primary" : "text-muted-foreground"} />
                <span className={cn("font-semibold text-sm", role === "tenant" ? "text-primary" : "text-muted-foreground")}>Rent a Room</span>
                <span className="text-[11px] text-muted-foreground text-center">I'm a tenant looking for accommodation</span>
              </button>
              <button
                onClick={() => setRole("owner")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  role === "owner" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                )}
              >
                <Building2 size={24} className={role === "owner" ? "text-primary" : "text-muted-foreground"} />
                <span className={cn("font-semibold text-sm", role === "owner" ? "text-primary" : "text-muted-foreground")}>List a Room</span>
                <span className="text-[11px] text-muted-foreground text-center">I'm a property owner</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">First Name *</label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ramesh" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Last Name</label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Sharma" className="rounded-xl" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Email Address *</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-xl" />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Phone Number</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="98XXXXXXXX" className="rounded-xl" />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Preferred City</label>
            <select
              value={preferredCity}
              onChange={e => setPreferredCity(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select city (optional)</option>
              {NEPAL_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Password *</label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="rounded-xl pr-10"
              />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Confirm Password *</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className={cn("rounded-xl", confirmPassword && password !== confirmPassword ? "border-destructive" : "")}
            />
          </div>

          <Button onClick={handleRegister} disabled={loading} className="w-full h-11 rounded-xl font-semibold">
            {loading ? "Creating account..." : "Create Account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4 px-4">
          Verify your identity soon after signing in to unlock full platform features. This keeps everyone safe.
        </p>
      </div>
    </div>
  );
}
