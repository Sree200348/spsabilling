import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiErr } from "@/api";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const EMPTY_P = () => ({ _key: crypto.randomUUID(), name: "", mobile: "", player_id: "", ratio: 1 });

export default function OpenTableModal({ table, onClose, onDone }) {
  const [players, setPlayers] = useState([EMPTY_P()]);
  const [remarks, setRemarks] = useState("");
  const [directory, setDirectory] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get("/players").then(r => setDirectory(r.data)).catch(() => {}); }, []);

  function updateP(i, patch) { const cp = [...players]; cp[i] = { ...cp[i], ...patch }; setPlayers(cp); }
  function addP() { setPlayers([...players, EMPTY_P()]); }
  function removeP(i) { setPlayers(players.filter((_, x) => x !== i)); }

  function pickExisting(i, id) {
    if (!id || id === "__none") { updateP(i, { player_id: "" }); return; }
    const p = directory.find(x => x.id === id);
    if (p) updateP(i, { player_id: id, name: p.name, mobile: p.mobile || "" });
  }

  async function submit() {
    if (!players.length || !players[0].name.trim()) return toast.error("At least one player required");
    setSaving(true);
    try {
      const body = {
        table_id: table.id,
        player_name: players[0].name,
        mobile: players[0].mobile,
        player_id: players[0].player_id || null,
        num_players: players.length,
        remarks,
        players: players.map(p => ({ name: p.name, mobile: p.mobile, player_id: p.player_id || null, ratio: Number(p.ratio) || 1 })),
      };
      await api.post("/sessions/open", body);
      toast.success(`${table.name} opened`);
      onDone();
    } catch (e) { toast.error(apiErr(e)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Open {table.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-zinc-400">Players ({players.length})</div>
            <Button size="sm" onClick={addP} data-testid="open-add-player-btn" className="bg-zinc-800 hover:bg-zinc-700"><Plus size={12} className="mr-1"/> Add Player</Button>
          </div>
          {players.map((p, i) => (
            <div key={p._key} className="border border-zinc-800 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#10B981] font-bold">PLAYER {i + 1}</div>
                {players.length > 1 && <Button variant="ghost" size="sm" className="text-red-400 h-7 w-7 p-0" onClick={() => removeP(i)} data-testid={`open-remove-player-${i}`}><Trash2 size={12}/></Button>}
              </div>
              <Select value={p.player_id || "__none"} onValueChange={(v) => pickExisting(i, v)}>
                <SelectTrigger data-testid={`open-player-select-${i}`} className="bg-zinc-900 border-zinc-800 h-9"><SelectValue placeholder="Existing player (optional)" /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectItem value="__none">— Walk-in —</SelectItem>
                  {directory.map(d => <SelectItem key={d.id} value={d.id}>{d.name} {d.mobile ? `· ${d.mobile}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input data-testid={`open-name-input-${i}`} placeholder="Name *" value={p.name} onChange={(e) => updateP(i, { name: e.target.value })} className="bg-zinc-900 border-zinc-800 h-9" />
                <Input data-testid={`open-mobile-input-${i}`} placeholder="Mobile" value={p.mobile} onChange={(e) => updateP(i, { mobile: e.target.value })} className="bg-zinc-900 border-zinc-800 h-9" />
              </div>
              {players.length > 1 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400">Ratio</span>
                  <Input data-testid={`open-ratio-input-${i}`} type="number" min="0" step="0.1" value={p.ratio} onChange={(e) => updateP(i, { ratio: e.target.value })} className="bg-zinc-900 border-zinc-800 h-8 w-24" />
                  <span className="text-zinc-500">of table amount</span>
                </div>
              )}
            </div>
          ))}
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
