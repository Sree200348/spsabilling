import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api, apiErr } from "@/api";
import { fmt, fmtDuration } from "@/utils";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const METHODS = ["cash", "upi", "card", "credit"];

export default function CloseTableModal({ session, onClose, onDone }) {
  const [manualDiscount, setManualDiscount] = useState(0);
  const [applyMemToSnacks, setApplyMemToSnacks] = useState(false);
  const [payments, setPayments] = useState([{ _key: crypto.randomUUID(), method: "cash", amount: 0 }]);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ratios, setRatios] = useState({}); // { player_local_id: ratio }
  const [ratiosInit, setRatiosInit] = useState(false);
  const [tablePayerId, setTablePayerId] = useState("__split");

  async function saveRatios(next) {
    try {
      await api.post(`/sessions/${session.id}/ratios`, { ratios: next });
    } catch (e) { toast.error(apiErr(e)); }
  }

  async function refresh() {
    try {
      const r = await api.get(`/sessions/${session.id}/preview-bill`, {
        params: {
          manual_discount: Number(manualDiscount) || 0,
          apply_membership_to_snacks: applyMemToSnacks,
          table_payer_id: tablePayerId && tablePayerId !== "__split" ? tablePayerId : undefined,
        },
      });
      setPreview(r.data);
      if (!ratiosInit) {
        const init = {};
        (r.data.session.players || []).forEach(p => { init[p.id] = Number(p.ratio) || 1; });
        setRatios(init);
        setRatiosInit(true);
      }
    } catch (e) { toast.error(apiErr(e)); }
  }
  useEffect(() => { refresh(); }, [manualDiscount, applyMemToSnacks, tablePayerId]);

  function setPay(i, k, v) {
    const cp = [...payments];
    cp[i] = { ...cp[i], [k]: k === "amount" ? Number(v) || 0 : v };
    setPayments(cp);
  }
  function addPay() { setPayments([...payments, { _key: crypto.randomUUID(), method: "cash", amount: 0 }]); }
  function removePay(i) { setPayments(payments.filter((_, x) => x !== i)); }
  function fillFull() {
    const p = [...payments];
    const total = preview?.billing?.final_amount || 0;
    const others = p.slice(1).reduce((a, x) => a + x.amount, 0);
    p[0] = { ...p[0], amount: Math.max(0, total - others) };
    setPayments(p);
  }
  const totalPaid = payments.reduce((a, p) => a + Number(p.amount || 0), 0);
  const final = preview?.billing?.final_amount || 0;
  const credit = Math.max(0, final - totalPaid);

  async function submitAndReturn(overridePayments, payFull) {
    const pays = overridePayments || payments;
    setSaving(true);
    try {
      const r = await api.post(`/sessions/${session.id}/close`, {
        manual_discount: Number(manualDiscount) || 0,
        apply_membership_to_snacks: applyMemToSnacks,
        payments: pays,
        table_payer_id: tablePayerId && tablePayerId !== "__split" ? tablePayerId : null,
        pay_full: !!payFull,
      });
      return r.data;
    } catch (e) { toast.error(apiErr(e)); return null; }
    finally { setSaving(false); }
  }

  async function submit() {
    // If cashier intended to pay in full (within rounding tolerance), let server absorb tiny drift.
    const nearFull = Math.abs(totalPaid - final) < 1;
    const inv = await submitAndReturn(undefined, nearFull);
    if (inv) { toast.success("Bill generated"); onDone(inv); }
  }

  const b = preview?.billing;
  const mem = preview?.membership;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Close &amp; Bill · {session.player_name}</DialogTitle></DialogHeader>
        {b && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-widest text-zinc-400">Session</div>
              {b.entries.map((e) => (
                <div key={`${e.table_id}-${e.start_time}`} className="border border-zinc-800 p-3 rounded-md text-sm">
                  <div className="flex justify-between font-semibold"><span>{e.table_name}</span><span>{fmt(e.amount)}</span></div>
                  <div className="text-xs text-zinc-400">Billable: {fmtDuration(e.billable_seconds)} @ ₹{e.hourly_rate}/hr</div>
                </div>
              ))}
              <div className="space-y-1 text-sm border-t border-zinc-800 pt-3">
                <Row k="Table amount" v={fmt(b.table_amount)} />
                <Row k="Snacks total" v={fmt(b.snacks_total)} />
                {mem && <Row k={`${mem.name} (${b.membership_percent}% off table)`} v={`- ${fmt(b.membership_discount)}`} accent />}
                {b.snacks_discount > 0 && <Row k={`Membership on snacks`} v={`- ${fmt(b.snacks_discount)}`} accent />}
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Manual discount</span>
                  <Input data-testid="close-manual-discount" type="number" min="0" value={manualDiscount} onChange={(e) => setManualDiscount(e.target.value)} className="w-28 h-8 bg-zinc-900 border-zinc-800 text-right" />
                </div>
                {mem && (
                  <label className="flex items-center gap-2 text-xs pt-2">
                    <Checkbox data-testid="close-mem-snacks" checked={applyMemToSnacks} onCheckedChange={setApplyMemToSnacks} />
                    Apply membership discount to snacks too
                  </label>
                )}
                <div className="border-t border-zinc-800 pt-2 mt-2 flex justify-between text-xl font-bold">
                  <span>Final</span>
                  <span className="text-[#10B981]" data-testid="close-final-amount">{fmt(b.final_amount)}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Payments</div>
              <div className="flex gap-2 mb-3">
                <Button size="sm" onClick={fillFull} className="bg-zinc-800 hover:bg-zinc-700" data-testid="pay-fill-full">Fill Full</Button>
                <Button size="sm" onClick={addPay} className="bg-zinc-800 hover:bg-zinc-700" data-testid="pay-add">+ Method</Button>
              </div>
              <div className="space-y-2">
                {payments.map((p, i) => (
                  <div key={p._key} className="flex gap-2 items-center">
                    <select data-testid={`pay-method-${i}`} value={p.method} onChange={(e) => setPay(i, "method", e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded h-9 px-2 text-sm">
                      {METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                    </select>
                    <Input data-testid={`pay-amount-${i}`} type="number" min="0" value={p.amount} onChange={(e) => setPay(i, "amount", e.target.value)} className="bg-zinc-900 border-zinc-800" />
                    {payments.length > 1 && <Button variant="ghost" onClick={() => removePay(i)} className="h-9 w-9 p-0 text-red-400" data-testid={`pay-remove-${i}`}><Trash2 size={14}/></Button>}
                  </div>
                ))}
              </div>
              {b.per_player && b.per_player.length > 1 && (
                <div className="mt-4 border-t border-zinc-800 pt-3">
                  <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Table Paid By</div>
                  <select data-testid="table-payer-select" value={tablePayerId} onChange={(e) => setTablePayerId(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded h-9 px-2 text-sm mb-3">
                    <option value="__split">Split total table bill by ratio (default)</option>
                    {b.per_player.map(pp => <option key={pp.player_local_id} value={pp.player_local_id}>{`Only ${pp.name} pays for table`}</option>)}
                  </select>
                  <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Per-Player Breakdown &amp; Ratio</div>
                  <div className="space-y-2">
                    {b.per_player.map((pp) => (
                      <div key={pp.player_local_id} className="text-xs border border-zinc-800 rounded p-2" data-testid={`per-player-${pp.name}`}>
                        <div className="flex justify-between font-semibold items-center">
                          <span>{pp.name} <span className="text-zinc-500">({pp.share_percent}%)</span></span>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500 text-[10px]">Ratio</span>
                            <Input
                              data-testid={`ratio-input-${pp.name}`}
                              type="number"
                              min="0"
                              step="0.1"
                              value={ratios[pp.player_local_id] ?? pp.ratio}
                              onChange={async (e) => {
                                const next = { ...ratios, [pp.player_local_id]: Number(e.target.value) || 0 };
                                setRatios(next);
                                await saveRatios(next);
                                refresh();
                              }}
                              className="bg-zinc-900 border-zinc-800 h-7 w-16 text-right"
                            />
                            <span className="text-[#10B981] font-bold">{fmt(pp.subtotal)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-zinc-400 mt-1"><span>Table share</span><span>{fmt(pp.table_share)}</span></div>
                        <div className="flex justify-between text-zinc-400"><span>Snacks</span><span>{fmt(pp.snacks_share)}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 space-y-1 text-sm border-t border-zinc-800 pt-3">
                <Row k="Total Paid" v={fmt(totalPaid)} />
                <Row k="Credit / Balance" v={fmt(credit)} accent={credit > 0} />
              </div>
              {credit > 0 && (
                <div className="mt-2 text-xs text-[#F59E0B]" data-testid="close-unpaid-note">{fmt(credit)} will stay unpaid — collect it later from the Payments page{session.player_id ? "" : " (unlinked bill)"}.</div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-zinc-700" data-testid="close-cancel-btn">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="close-save-btn">Generate Bill</Button>
          <Button
            onClick={async () => {
              // Auto-fill full amount to avoid rounding-drift credits.
              const totalNow = preview?.billing?.final_amount || 0;
              const p = [...payments];
              const others = p.slice(1).reduce((a, x) => a + x.amount, 0);
              p[0] = { ...p[0], amount: Math.max(0, totalNow - others) };
              setPayments(p);
              const invoice = await submitAndReturn(p, true);
              if (!invoice) return;
              try {
                const players = (preview?.session?.players || []).map(pl => ({ name: pl.name, mobile: pl.mobile || "", player_id: pl.player_id || null, ratio: 1 }));
                await api.post("/sessions/open", {
                  table_id: session.current_table_id, player_name: players[0]?.name || session.player_name,
                  mobile: players[0]?.mobile || "", player_id: players[0]?.player_id || null,
                  num_players: players.length, remarks: "New frame", players,
                });
                toast.success("New frame started");
                onDone(invoice);
              } catch (e) { toast.error(apiErr(e)); }
            }}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
            data-testid="close-and-open-btn"
          >Close &amp; New Frame</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, accent }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-400">{k}</span>
      <span className={accent ? "text-[#10B981] font-semibold" : ""}>{v}</span>
    </div>
  );
}
