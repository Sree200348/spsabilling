import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, apiErr } from "@/api";
import { toast } from "sonner";
import { UserPlus, Search } from "lucide-react";

export default function AttachPlayerModal({ session, onClose, onDone }) {
  const [tab, setTab] = useState("existing");
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [saveToList, setSaveToList] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => api.get(`/players${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(r => setPlayers(r.data)), 200);
    return () => clearTimeout(t);
  }, [q]);

  async function attach(p) {
    await api.post(`/sessions/${session.id}/add-player`, { name: p.name, mobile: p.mobile || "", player_id: p.id || null, ratio: 1 });
    toast.success(`${p.name} added to session`);
    onDone();
  }

  async function pick(p) {
    try { await attach(p); } catch (e) { toast.error(apiErr(e)); }
  }

  async function addNew() {
    if (!name.trim()) { toast.error("Enter a name"); return; }
    setSaving(true);
    try {
      let p = { name: name.trim(), mobile: mobile.trim(), id: null };
      if (saveToList) {
        const r = await api.post("/players", { name: p.name, mobile: p.mobile });
        p = { ...p, id: r.data.id };
      }
      await attach(p);
    } catch (e) { toast.error(apiErr(e)); }
    finally { setSaving(false); }
  }

  const tabCls = (t) => `flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${tab === t ? "bg-[#10B981] text-[#0A0A0A]" : "bg-zinc-900 text-zinc-400 hover:text-white"}`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
        <DialogHeader><DialogTitle>Add Player to Session</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <button className={tabCls("existing")} onClick={() => setTab("existing")} data-testid="attach-tab-existing"><Search size={14}/> Existing</button>
          <button className={tabCls("new")} onClick={() => setTab("new")} data-testid="attach-tab-new"><UserPlus size={14}/> New Player</button>
        </div>

        {tab === "existing" ? (
          <>
            <Input data-testid="attach-search-input" placeholder="Search name or mobile…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            <div className="max-h-80 overflow-y-auto space-y-1">
              {players.map(p => (
                <button key={p.id} data-testid={`attach-player-${p.id}`} onClick={() => pick(p)} className="w-full text-left border border-zinc-800 hover:border-[#10B981] p-3 rounded-md transition-colors">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-zinc-400">{p.mobile || "—"} · Credit ₹{p.credit_balance?.toFixed(2) || "0.00"}</div>
                </button>
              ))}
              {!players.length && (
                <div className="text-zinc-500 text-sm">
                  No players found. <button className="text-[#10B981] underline" onClick={() => { setName(q); setTab("new"); }} data-testid="attach-switch-new">Add "{q || "new player"}" as new</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div><Label className="text-zinc-400 text-xs uppercase tracking-widest">Name *</Label>
              <Input data-testid="attach-new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" className="bg-zinc-900 border-zinc-800" autoFocus /></div>
            <div><Label className="text-zinc-400 text-xs uppercase tracking-widest">Mobile</Label>
              <Input data-testid="attach-new-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Optional" className="bg-zinc-900 border-zinc-800" /></div>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={saveToList} onChange={(e) => setSaveToList(e.target.checked)} data-testid="attach-new-save" className="accent-[#10B981]" />
              Save to players list (enables credit &amp; history)
            </label>
            <Button onClick={addNew} disabled={saving} className="w-full bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="attach-new-submit">
              <UserPlus size={14} className="mr-1"/> {saving ? "Adding…" : "Add to Session"}
            </Button>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose} className="border-zinc-700" data-testid="attach-close-btn">Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
