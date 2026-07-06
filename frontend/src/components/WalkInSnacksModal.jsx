import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiErr } from "@/api";
import { fmt } from "@/utils";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const METHODS = ["cash", "upi", "card", "credit"];

export default function WalkInSnacksModal({ onClose, onDone }) {
  const [items, setItems] = useState([]);
  const [players, setPlayers] = useState([]);
  const [customerName, setCustomerName] = useState("Walk-in");
  const [mobile, setMobile] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [lines, setLines] = useState([]); // {_key, item_id, qty}
  const [pick, setPick] = useState({ item_id: "", qty: 1 });
  const [payments, setPayments] = useState([{ _key: crypto.randomUUID(), method: "cash", amount: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/inventory").then((r) => setItems(r.data)).catch((e) => toast.error(apiErr(e)));
    api.get("/players").then((r) => setPlayers(r.data)).catch(() => {});
  }, []);

  const total = lines.reduce((a, l) => {
    const it = items.find((x) => x.id === l.item_id);
    return a + (it ? it.selling_price * l.qty : 0);
  }, 0);
  const paid = payments.reduce((a, p) => a + Number(p.amount || 0), 0);
  const credit = Math.max(0, total - paid);

  function addLine() {
    if (!pick.item_id) return toast.error("Choose a snack");
    const q = Math.max(1, Number(pick.qty || 1));
    setLines([...lines, { _key: crypto.randomUUID(), item_id: pick.item_id, qty: q }]);
    setPick({ item_id: "", qty: 1 });
  }
  function removeLine(k) {
    setLines(lines.filter((l) => l._key !== k));
  }
  function setPay(i, k, v) {
    const cp = [...payments];
    cp[i] = { ...cp[i], [k]: k === "amount" ? Number(v) || 0 : v };
    setPayments(cp);
  }
  function addPay() { setPayments([...payments, { _key: crypto.randomUUID(), method: "cash", amount: 0 }]); }
  function removePay(i) { setPayments(payments.filter((_, x) => x !== i)); }
  function fillFull() {
    const p = [...payments];
    const others = p.slice(1).reduce((a, x) => a + x.amount, 0);
    p[0] = { ...p[0], amount: Math.max(0, total - others) };
    setPayments(p);
  }

  async function submit() {
    if (!lines.length) return toast.error("Add at least one item");
    if (credit > 0 && !playerId) return toast.error("Credit requires a linked player");
    setSaving(true);
    try {
      const r = await api.post("/walk-in/sale", {
        customer_name: playerId ? (players.find((p) => p.id === playerId)?.name || customerName) : customerName,
        mobile,
        player_id: playerId || null,
        items: lines.map((l) => ({ item_id: l.item_id, qty: l.qty })),
        payments: payments.map((p) => ({ method: p.method, amount: Number(p.amount || 0) })),
      });
      toast.success("Walk-in sale saved");
      onDone(r.data);
    } catch (e) { toast.error(apiErr(e)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Walk-in Snack Sale</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-zinc-400">Customer Name</Label>
              <Input data-testid="walkin-customer-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Mobile (optional)</Label>
              <Input data-testid="walkin-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Link to Player (optional, required for credit)</Label>
              <Select value={playerId || "__none"} onValueChange={(v) => setPlayerId(v === "__none" ? "" : v)}>
                <SelectTrigger data-testid="walkin-player-select" className="bg-zinc-900 border-zinc-800"><SelectValue placeholder="No player linked" /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white max-h-64">
                  <SelectItem value="__none">— No player —</SelectItem>
                  {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} {p.mobile ? `· ${p.mobile}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <Label className="text-xs uppercase tracking-widest text-zinc-400">Add Snack</Label>
              <div className="flex gap-2 mt-2">
                <Select value={pick.item_id || "__pick"} onValueChange={(v) => setPick({ ...pick, item_id: v === "__pick" ? "" : v })}>
                  <SelectTrigger data-testid="walkin-item-select" className="bg-zinc-900 border-zinc-800 flex-1"><SelectValue placeholder="Choose item" /></SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white max-h-64">
                    <SelectItem value="__pick">— Choose —</SelectItem>
                    {items.map((it) => <SelectItem key={it.id} value={it.id} disabled={it.stock <= 0}>{it.name} · {fmt(it.selling_price)} ({it.stock} left)</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input data-testid="walkin-item-qty" type="number" min="1" value={pick.qty} onChange={(e) => setPick({ ...pick, qty: Number(e.target.value) || 1 })} className="w-20 bg-zinc-900 border-zinc-800" />
                <Button data-testid="walkin-add-line" onClick={addLine} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A]"><Plus size={14}/></Button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-400">Items</Label>
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {lines.length === 0 && <div className="text-zinc-500 text-sm">No items added.</div>}
                {lines.map((l) => {
                  const it = items.find((x) => x.id === l.item_id);
                  return (
                    <div key={l._key} data-testid={`walkin-line-${l._key}`} className="flex items-center justify-between border border-zinc-800 rounded px-2 py-1 text-sm">
                      <span className="truncate">{it?.name || "?"} × {l.qty}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#10B981] font-semibold">{fmt((it?.selling_price || 0) * l.qty)}</span>
                        <Button variant="ghost" onClick={() => removeLine(l._key)} className="h-7 w-7 p-0 text-red-400"><Trash2 size={12}/></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-[#10B981]" data-testid="walkin-total">{fmt(total)}</span></div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-widest text-zinc-400">Payments</Label>
                <div className="flex gap-1">
                  <Button size="sm" onClick={fillFull} className="h-7 bg-zinc-800 hover:bg-zinc-700 text-xs" data-testid="walkin-fill-full">Fill</Button>
                  <Button size="sm" onClick={addPay} className="h-7 bg-zinc-800 hover:bg-zinc-700 text-xs" data-testid="walkin-add-pay">+ Method</Button>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                {payments.map((p, i) => (
                  <div key={p._key} className="flex gap-2 items-center">
                    <select data-testid={`walkin-pay-method-${i}`} value={p.method} onChange={(e) => setPay(i, "method", e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded h-9 px-2 text-sm">
                      {METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                    </select>
                    <Input data-testid={`walkin-pay-amount-${i}`} type="number" min="0" value={p.amount} onChange={(e) => setPay(i, "amount", e.target.value)} className="bg-zinc-900 border-zinc-800" />
                    {payments.length > 1 && <Button variant="ghost" onClick={() => removePay(i)} className="h-9 w-9 p-0 text-red-400"><Trash2 size={14}/></Button>}
                  </div>
                ))}
              </div>
              <div className="text-xs mt-2 flex justify-between"><span className="text-zinc-400">Paid</span><span>{fmt(paid)}</span></div>
              <div className="text-xs flex justify-between"><span className="text-zinc-400">Credit / Balance</span><span className={credit > 0 ? "text-[#F59E0B] font-semibold" : ""} data-testid="walkin-credit">{fmt(credit)}</span></div>
              {credit > 0 && !playerId && <div className="text-xs text-red-400 mt-1">Link a player to save credit.</div>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-zinc-700" data-testid="walkin-cancel">Cancel</Button>
          <Button onClick={submit} disabled={saving || !lines.length} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="walkin-save">Save Sale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
