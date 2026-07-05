import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiErr } from "@/api";
import { toast } from "sonner";

export default function OpenTableModal({ table, onClose, onDone }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [num, setNum] = useState(1);
  const [remarks, setRemarks] = useState("");
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [membership, setMembership] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/players").then((r) => setPlayers(r.data)).catch(() => {});
  }, []);

  async function pickPlayer(id) {
    setPlayerId(id);
    if (!id || id === "__none") { setMembership(null); setPlayerId(""); return; }
    const p = players.find((x) => x.id === id);
    if (p) {
      setName(p.name);
      setMobile(p.mobile || "");
      if (p.membership_id) {
        try {
          const mems = await api.get("/memberships");
          const m = mems.data.find((x) => x.id === p.membership_id);
          setMembership(m || null);
        } catch {}
      } else {
        setMembership(null);
      }
    }
  }

  async function submit() {
    if (!name.trim()) return toast.error("Player name required");
    setSaving(true);
    try {
      await api.post("/sessions/open", {
        table_id: table.id, player_name: name, mobile,
        player_id: playerId || null, num_players: Number(num) || 1, remarks,
      });
      toast.success(`${table.name} opened`);
      onDone();
    } catch (e) {
      toast.error(apiErr(e));
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
        <DialogHeader><DialogTitle>Open {table.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-zinc-400 text-xs uppercase tracking-widest">Existing Player (optional)</Label>
            <Select value={playerId || "__none"} onValueChange={pickPlayer}>
              <SelectTrigger data-testid="open-player-select" className="bg-zinc-900 border-zinc-800"><SelectValue placeholder="Select or enter new" /></SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                <SelectItem value="__none">— New / Walk-in —</SelectItem>
                {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} {p.mobile ? `· ${p.mobile}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            {membership && <div className="mt-2 text-xs text-[#10B981]">✓ {membership.name} · {membership.discount_percent}% off</div>}
          </div>
          <div>
            <Label className="text-zinc-400 text-xs uppercase tracking-widest">Player Name *</Label>
            <Input data-testid="open-name-input" value={name} onChange={(e) => setName(e.target.value)} className="bg-zinc-900 border-zinc-800" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-widest">Mobile</Label>
              <Input data-testid="open-mobile-input" value={mobile} onChange={(e) => setMobile(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-widest"># Players</Label>
              <Input data-testid="open-num-input" type="number" min="1" value={num} onChange={(e) => setNum(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            </div>
          </div>
          <div>
            <Label className="text-zinc-400 text-xs uppercase tracking-widest">Remarks</Label>
            <Textarea data-testid="open-remarks-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="bg-zinc-900 border-zinc-800" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="open-cancel-btn" className="border-zinc-700">Cancel</Button>
          <Button data-testid="open-confirm-btn" disabled={saving} onClick={submit} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold">Open Table</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
