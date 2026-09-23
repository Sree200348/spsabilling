import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api, apiErr } from "@/api";
import { Mail, Smartphone, CheckCircle2 } from "lucide-react";
import AuthShell from "@/components/AuthShell";

export default function ForgotPassword() {
  const [tab, setTab] = useState("email");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setL] = useState(false);
  const [sent, setSent] = useState(null);
  const [done, setDone] = useState(false);

  async function sendLink(e) {
    e.preventDefault(); setL(true);
    try {
      const r = await api.post("/auth/forgot-password", { username });
      setSent(r.data);
    } catch (e) { toast.error(apiErr(e)); } finally { setL(false); }
  }

  async function resetMobile(e) {
    e.preventDefault();
    if (pw !== pw2) { toast.error("Passwords do not match"); return; }
    setL(true);
    try {
      await api.post("/auth/reset-by-mobile", { username, mobile, new_password: pw });
      setDone(true);
    } catch (e) { toast.error(apiErr(e)); } finally { setL(false); }
  }

  const tabCls = (t) => `flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${tab === t ? "bg-[#10B981] text-[#0A0A0A]" : "bg-zinc-900 text-zinc-400 hover:text-white"}`;
  const inputCls = "bg-zinc-900 border-zinc-800 focus:border-[#10B981]";

  if (done) return (
    <AuthShell kicker="Password reset" title="You're all set" subtitle="Your password has been changed.">
      <div className="text-center space-y-4"><CheckCircle2 className="mx-auto text-[#10B981]" size={40} />
        <Button asChild className="w-full bg-[#10B981] text-[#0A0A0A] hover:bg-[#059669] font-bold h-11"><Link to="/login" data-testid="forgot-back-login">Sign in</Link></Button></div>
    </AuthShell>
  );

  return (
    <AuthShell kicker="Forgot password" title="Reset your password" subtitle="Choose how you'd like to verify it's you.">
      <div className="flex gap-2 mb-5">
        <button type="button" className={tabCls("email")} onClick={() => setTab("email")} data-testid="forgot-tab-email"><Mail size={14}/> Email link</button>
        <button type="button" className={tabCls("mobile")} onClick={() => setTab("mobile")} data-testid="forgot-tab-mobile"><Smartphone size={14}/> Club mobile</button>
      </div>
      {tab === "email" ? (
        sent ? (
          <div className="space-y-4 text-sm" data-testid="forgot-email-result">
            {sent.email_sent ? (
              <p className="text-zinc-300">A reset link was sent to <b className="text-[#10B981]">{sent.email_hint}</b>. It expires in 1 hour — check spam too.</p>
            ) : (
              <p className="text-zinc-300">If that account has an email on file, a reset link is on its way. No email on file? Use the <button className="text-[#10B981] underline" onClick={() => setTab("mobile")}>club mobile</button> option instead.</p>
            )}
            <Link to="/login" className="text-[#10B981] font-semibold" data-testid="forgot-back-login">← Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={sendLink} className="space-y-4">
            <div className="space-y-1"><Label className="text-zinc-300">Username</Label>
              <Input data-testid="forgot-username-input" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus className={inputCls} /></div>
            <Button type="submit" disabled={loading} className="w-full bg-[#10B981] text-[#0A0A0A] hover:bg-[#059669] font-bold h-11" data-testid="forgot-send-btn">{loading ? "Sending…" : "Send reset link"}</Button>
          </form>
        )
      ) : (
        <form onSubmit={resetMobile} className="space-y-4">
          <div className="space-y-1"><Label className="text-zinc-300">Username</Label>
            <Input data-testid="forgot-m-username-input" value={username} onChange={(e) => setUsername(e.target.value)} required className={inputCls} /></div>
          <div className="space-y-1"><Label className="text-zinc-300">Club's registered mobile</Label>
            <Input data-testid="forgot-mobile-input" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} required className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-zinc-300">New password</Label>
              <Input data-testid="forgot-newpw-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} className={inputCls} /></div>
            <div className="space-y-1"><Label className="text-zinc-300">Confirm</Label>
              <Input data-testid="forgot-newpw2-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required className={inputCls} /></div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#10B981] text-[#0A0A0A] hover:bg-[#059669] font-bold h-11" data-testid="forgot-mobile-submit">{loading ? "Resetting…" : "Reset password"}</Button>
        </form>
      )}
      {!sent && <p className="text-sm text-zinc-400 text-center mt-5"><Link to="/login" className="text-[#10B981] font-semibold" data-testid="forgot-login-link">← Back to sign in</Link></p>}
    </AuthShell>
  );
}
