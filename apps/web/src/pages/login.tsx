import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Login() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      toast({ title: "Enter your email and password", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");

      // Store JWT for API calls
      if (data.token) {
        localStorage.setItem("ghar_khoj_jwt", String(data.token));
      }

      localStorage.setItem("ghar_khoj_real_user_id", String(data.id));
      localStorage.setItem("ghar_khoj_user_id", String(data.id));
      toast({ title: `Welcome back, ${data.firstName}!` });
      window.location.href = import.meta.env.BASE_URL;
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
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
          <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
          <p className="text-muted-foreground mt-1 text-sm">Access your Ghar Khoj account</p>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Email Address</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="you@example.com"
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Password</label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Your password"
                className="rounded-xl pr-10"
              />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button onClick={handleLogin} disabled={loading} className="w-full h-11 rounded-xl font-semibold">
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account? <Link href="/register" className="text-primary font-semibold hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

