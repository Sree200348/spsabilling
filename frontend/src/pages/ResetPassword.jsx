import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api, apiErr } from "@/api";
import AuthShell from "@/components/AuthShell";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setL] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pw !== pw2) { toast.error("Passwords do not match"); return; }
    setL(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pw });
      toast.success("Password updated. Please sign in.");
      nav("/login");
    } catch (e) { toast.error(apiErr(e)); } finally { setL(false); }
  }

  const inputCls = "bg-zinc-900 border-zinc-800 focus:border-[#10B981]";
  return (
    <AuthShell kicker="Reset password" title="Choose a new password" subtitle={token ? "This link works once and expires after 1 hour." : "This reset link is missing its token."}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1"><Label className="text-zinc-300">New password</Label>
          <Input data-testid="reset-newpw-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} autoFocus className={inputCls} /></div>
        <div className="space-y-1"><Label className="text-zinc-300">Confirm password</Label>
          <Input data-testid="reset-newpw2-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required className={inputCls} /></div>
        <Button type="submit" disabled={loading || !token} className="w-full bg-[#10B981] text-[#0A0A0A] hover:bg-[#059669] font-bold h-11" data-testid="reset-submit-btn">{loading ? "Saving…" : "Set new password"}</Button>
      </form>
      <p className="text-sm text-zinc-400 text-center mt-5"><Link to="/forgot-password" className="text-[#10B981] font-semibold" data-testid="reset-request-again">Request a new link</Link></p>
    </AuthShell>
  );
}
