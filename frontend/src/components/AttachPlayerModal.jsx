import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, apiErr } from "@/api";
import { toast } from "sonner";

export default function AttachPlayerModal({ session, onClose, onDone }) {
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    const t = setTimeout(() => api.get(`/players${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(r => setPlayers(r.data)), 200);
    return () => clearTimeout(t);
  }, [q]);

  async function pick(p) {
    try {
      await api.post(`/sessions/${session.id}/attach-player`, { player_id: p.id });
      toast.success(`${p.name} linked`);
      onDone();
    } catch (e) { toast.error(apiErr(e)); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
        <DialogHeader><DialogTitle>Attach Player</DialogTitle></DialogHeader>
        <Input data-testid="attach-search-input" placeholder="Search name or mobile…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-zinc-900 border-zinc-800" />
        <div className="max-h-80 overflow-y-auto space-y-1">
          {players.map(p => (
            <button key={p.id} data-testid={`attach-player-${p.id}`} onClick={() => pick(p)} className="w-full text-left border border-zinc-800 hover:border-[#10B981] p-3 rounded-md transition-colors">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-zinc-400">{p.mobile || "—"} · Credit ₹{p.credit_balance?.toFixed(2) || "0.00"}</div>
            </button>
          ))}
          {!players.length && <div className="text-zinc-500 text-sm">No players found</div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} className="border-zinc-700" data-testid="attach-close-btn">Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
