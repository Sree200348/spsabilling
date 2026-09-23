import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiErr } from "@/api";

const FIELDS = [
  ["club_name", "Club Name", "text", "e.g. Cue Masters Snooker Club"],
  ["username", "Owner Username", "text", "min 3 characters"],
  ["password", "Password", "password", "min 6 characters"],
  ["mobile", "Mobile", "tel", "Contact number"],
  ["location", "Location", "text", "City / Area"],
];

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ club_name: "", username: "", password: "", mobile: "", location: "" });
  const [loading, setL] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setL(true);
    try {
      await register(form);
      toast.success(`${form.club_name} is ready. Welcome!`);
      nav("/");
    } catch (e) { toast.error(apiErr(e)); }
    finally { setL(false); }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#052e1e] to-[#0A0A0A] border-r border-zinc-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#10B981] grid place-items-center font-black text-[#0A0A0A]">SP</div>
          <div className="font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>SNOOKER BILLING CONSOLE</div>
        </div>
        <div>
          <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em] mb-4">New Club</div>
          <h1 className="text-5xl font-black leading-none tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            YOUR CLUB.<br /><span className="text-[#10B981]">YOUR CONSOLE.</span>
          </h1>
          <p className="mt-6 text-zinc-400 max-w-md">Register your snooker club and get a private workspace with 4 starter tables, snacks, memberships and full billing — separate from every other club.</p>
        </div>
        <div className="text-xs text-zinc-500 uppercase tracking-widest">v1.0 · Multi-club</div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="register-form">
          <div>
            <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">Register</div>
            <h2 className="text-3xl font-bold mt-2">Create a club account</h2>
            <p className="text-sm text-zinc-400 mt-2">You'll become the owner (admin) of this club.</p>
          </div>
          {FIELDS.map(([k, label, type, ph]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={k} className="text-zinc-300">{label}</Label>
              <Input id={k} data-testid={`register-${k.replace("_", "-")}-input`} type={type} placeholder={ph} value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k !== "location" && k !== "mobile"}
                className="bg-zinc-900 border-zinc-800 focus:border-[#10B981]" />
            </div>
          ))}
          <Button data-testid="register-submit-btn" type="submit" disabled={loading} className="w-full bg-[#10B981] text-[#0A0A0A] hover:bg-[#059669] font-bold h-11">
            {loading ? "Creating club…" : "Create Club & Sign In"}
          </Button>
          <p className="text-sm text-zinc-400 text-center">Already have an account? <Link to="/login" className="text-[#10B981] font-semibold" data-testid="register-login-link">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
