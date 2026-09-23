import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiErr } from "@/api";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [loading, setL] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setL(true);
    try {
      await login(username, password);
      toast.success("Welcome back");
      nav("/");
    } catch (e) {
      toast.error(apiErr(e));
    } finally {
      setL(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#052e1e] to-[#0A0A0A] border-r border-zinc-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#10B981] grid place-items-center font-black text-[#0A0A0A]">SP</div>
          <div className="font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>SOUTH POINT SNOOKER ACADEMY</div>
        </div>
        <div>
          <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em] mb-4">Command Console</div>
          <h1 className="text-5xl font-black leading-none tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            RUN YOUR CLUB<br /><span className="text-[#10B981]">LIKE A PRO.</span>
          </h1>
          <p className="mt-6 text-zinc-400 max-w-md">Live tables. Instant billing. Zero paperwork. Built for the counter, the phone, and everything in between.</p>
        </div>
        <div className="text-xs text-zinc-500 uppercase tracking-widest">v1.0 · Cashier &amp; Admin Portal</div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6">
          <div>
            <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">Sign In</div>
            <h2 className="text-3xl font-bold mt-2">Access your dashboard</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username" className="text-zinc-300">Username</Label>
            <Input id="username" data-testid="login-username-input" value={username} onChange={(e) => setU(e.target.value)} autoFocus className="bg-zinc-900 border-zinc-800 focus:border-[#10B981]" required />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center"><Label htmlFor="password" className="text-zinc-300">Password</Label><Link to="/forgot-password" className="text-xs text-[#10B981] hover:underline" data-testid="login-forgot-link">Forgot password?</Link></div>
            <Input id="password" data-testid="login-password-input" type="password" value={password} onChange={(e) => setP(e.target.value)} className="bg-zinc-900 border-zinc-800 focus:border-[#10B981]" required />
          </div>
          <Button data-testid="login-submit-btn" type="submit" disabled={loading} className="w-full bg-[#10B981] text-[#0A0A0A] hover:bg-[#059669] font-bold h-11">
            {loading ? "Signing in…" : "Sign In"}
          </Button>
          <div className="flex items-center gap-3 text-xs text-zinc-500"><div className="flex-1 h-px bg-zinc-800" />New snooker club?<div className="flex-1 h-px bg-zinc-800" /></div>
          <Button asChild variant="outline" className="w-full border-[#10B981]/50 text-[#10B981] hover:bg-[#10B981]/10 hover:text-[#10B981] h-11 font-bold">
            <Link to="/register" data-testid="login-register-btn">Register Your Club</Link>
          </Button>
        </form>
      </div>
    </div>
  );
}
