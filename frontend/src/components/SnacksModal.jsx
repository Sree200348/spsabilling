import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiErr } from "@/api";
import { fmt } from "@/utils";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export default function SnacksModal({ session, onClose, onChange }) {
  const [items, setItems] = useState([]);
  const [snacks, setSnacks] = useState(session.snacks || []);
  const [sessionPlayers, setSessionPlayers] = useState(session.players || []);
  const [pick, setPick] = useState({}); // per player-id: {item_id, qty}

  async function refresh() {
    const [inv, ses] = await Promise.all([api.get("/inventory"), api.get(`/sessions/${session.id}`)]);
    setItems(inv.data);
    setSnacks(ses.data.snacks || []);
    setSessionPlayers(ses.data.players || []);
  }
  useEffect(() => { refresh(); }, []);

  // Groups: one per player + shared
  const groups = [
    ...sessionPlayers.map(p => ({ key: p.id, id: p.id, label: p.name })),
    { key: "__shared", id: null, label: "Shared" },
  ];

  async function add(groupId, assigned_to) {
    const sel = pick[groupId] || {};
    if (!sel.item_id) return toast.error("Choose a snack");
    const q = Number(sel.qty || 1);
    try {
      const r = await api.post(`/sessions/${session.id}/snacks`, { item_id: sel.item_id, qty: q, assigned_to });
      const it = items.find(x => x.id === sel.item_id);
      toast.success(`${it?.name || "Snack"} × ${q} added`);
      if (r.data.low_stock) toast.warning(`Low stock! ${r.data.stock_left} left`);
      setPick({ ...pick, [groupId]: { item_id: "", qty: 1 } });
      refresh();
      onChange && onChange();
    } catch (e) { toast.error(apiErr(e)); }
  }

  async function remove(snack) {
    try {
      await api.delete(`/sessions/${session.id}/snacks/${snack.id}`);
      refresh();
      onChange && onChange();
    } catch (e) { toast.error(apiErr(e)); }
  }

  function snacksFor(pid) {
    return snacks.filter(s => (pid === null ? !s.assigned_to : s.assigned_to === pid));
  }
  function subtotalFor(pid) {
    return snacksFor(pid).reduce((a, s) => a + s.total, 0);
  }
  const total = snacks.reduce((a, s) => a + s.total, 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Snacks · {session.player_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.key} className="border border-zinc-800 rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs uppercase tracking-widest text-[#10B981] font-bold">{g.label}</div>
                  <div className="text-xs text-zinc-500">{g.id ? "Charged directly to this player" : "Split across players by ratio"}</div>
                </div>
                <div className="text-sm font-bold text-[#10B981]" data-testid={`snacks-subtotal-${g.label}`}>{fmt(subtotalFor(g.id))}</div>
              </div>

              <div className="flex gap-2 items-center mb-2">
                <Select value={(pick[g.key]?.item_id) || "__none"} onValueChange={(v) => setPick({ ...pick, [g.key]: { ...(pick[g.key] || {}), item_id: v === "__none" ? "" : v } })}>
                  <SelectTrigger data-testid={`snack-item-${g.label}`} className="bg-zinc-900 border-zinc-800 h-9 flex-1"><SelectValue placeholder="Select snack…" /></SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                    {items.filter(it => it.stock > 0).map(it => (
                      <SelectItem key={it.id} value={it.id}>{it.name} · {fmt(it.selling_price)} · Stock {it.stock}</SelectItem>
                    ))}
                    {!items.filter(it => it.stock > 0).length && <div className="p-2 text-xs text-zinc-500">No items in stock</div>}
                  </SelectContent>
                </Select>
                <Input data-testid={`snack-qty-${g.label}`} type="number" min="1" value={pick[g.key]?.qty || 1} onChange={(e) => setPick({ ...pick, [g.key]: { ...(pick[g.key] || {}), qty: e.target.value } })} className="w-16 h-9 bg-zinc-900 border-zinc-800" />
                <Button data-testid={`snack-add-${g.label}`} onClick={() => add(g.key, g.id)} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] h-9"><Plus size={14} /></Button>
              </div>

              {snacksFor(g.id).length > 0 ? (
                <div className="space-y-1">
                  {snacksFor(g.id).map(s => (
                    <div key={s.id} className="flex items-center justify-between border border-zinc-800 rounded p-2 text-sm">
                      <div><span className="font-semibold">{s.name}</span> <span className="text-zinc-500">× {s.qty}</span></div>
                      <div className="flex items-center gap-2">
                        <div className="text-[#10B981]">{fmt(s.total)}</div>
                        <Button data-testid={`remove-snack-${s.id}`} onClick={() => remove(s)} variant="ghost" className="text-red-400 h-7 w-7 p-0"><Trash2 size={12}/></Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-zinc-500">Nothing yet</div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
            <span className="uppercase text-xs tracking-widest text-zinc-400">Snacks Total</span>
            <span className="text-xl font-bold text-[#10B981]" data-testid="snacks-total">{fmt(total)}</span>
          </div>
        </div>
        <div className="flex justify-end pt-3">
          <Button onClick={onClose} className="bg-zinc-800 hover:bg-zinc-700" data-testid="snacks-done-btn">Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
