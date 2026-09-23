import { useEffect, useState } from "react";
import { api, apiErr } from "@/api";
import { fmt, fmtDate } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Wallet, Receipt, Users } from "lucide-react";
import InvoiceModal from "@/components/InvoiceModal";

const STATUS_CLS = { paid: "text-[#10B981]", split: "text-[#10B981]", partial: "text-[#F59E0B]", credit: "text-red-400" };

export default function Payments() {
  const [tab, setTab] = useState("unpaid");
  const [unpaid, setUnpaid] = useState({ total_due: 0, count: 0, invoices: [], by_player: [] });
  const [all, setAll] = useState([]);
  const [playerKey, setPlayerKey] = useState(null);
  const [collectFor, setCollectFor] = useState(null);
  const [viewInv, setViewInv] = useState(null);

  async function load() {
    try {
      const [u, a] = await Promise.all([api.get("/invoices/unpaid"), api.get("/invoices")]);
      setUnpaid(u.data); setAll(a.data);
    } catch (e) { toast.error(apiErr(e)); }
  }
  useEffect(() => { load(); }, []);

  const keyOf = (i) => i.player_id || `walkin:${(i.player_name || "Walk-in").trim().toLowerCase()}`;
  const unpaidList = playerKey ? unpaid.invoices.filter(i => keyOf(i) === playerKey) : unpaid.invoices;
  const tabCls = (t) => `flex items-center gap-1 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${tab === t ? "bg-[#10B981] text-[#0A0A0A]" : "bg-zinc-900 text-zinc-400 hover:text-white"}`;

  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">Counter</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>PAYMENTS</h1>
        </div>
        <div className="border border-zinc-800 rounded-md p-4 text-right">
          <div className="text-xs uppercase tracking-widest text-zinc-400">Outstanding · {unpaid.count} bills</div>
          <div className="text-3xl font-black text-[#F59E0B]" data-testid="payments-total-due">{fmt(unpaid.total_due)}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <button className={tabCls("unpaid")} onClick={() => setTab("unpaid")} data-testid="payments-tab-unpaid"><Wallet size={14}/> Unpaid Bills</button>
        <button className={tabCls("all")} onClick={() => setTab("all")} data-testid="payments-tab-all"><Receipt size={14}/> All Closed Bills</button>
      </div>

      {tab === "unpaid" ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1"><Users size={12}/> Player-wise Totals</div>
            <div className="space-y-2">
              <button onClick={() => setPlayerKey(null)} data-testid="payments-player-all" className={`w-full text-left border rounded-md p-3 text-sm transition-colors ${!playerKey ? "border-[#10B981]" : "border-zinc-800 hover:border-zinc-600"}`}>
                <div className="flex justify-between"><span className="font-semibold">All players</span><span className="text-[#F59E0B] font-bold">{fmt(unpaid.total_due)}</span></div>
              </button>
              {unpaid.by_player.map(p => (
                <button key={p.key} onClick={() => setPlayerKey(p.key)} data-testid={`payments-player-${p.key}`} className={`w-full text-left border rounded-md p-3 text-sm transition-colors ${playerKey === p.key ? "border-[#10B981]" : "border-zinc-800 hover:border-zinc-600"}`}>
                  <div className="flex justify-between"><span className="font-semibold">{p.player_name}{!p.player_id && <span className="text-zinc-500 text-[10px] ml-1">(unlinked)</span>}</span><span className="text-[#F59E0B] font-bold">{fmt(p.due)}</span></div>
                  <div className="text-xs text-zinc-500">{p.invoices} bill{p.invoices > 1 ? "s" : ""} · billed {fmt(p.billed)} · paid {fmt(p.paid)}</div>
                </button>
              ))}
              {!unpaid.by_player.length && <div className="text-zinc-500 text-sm">Nothing outstanding</div>}
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Unpaid Bills ({unpaidList.length})</div>
            <BillTable rows={unpaidList} onView={setViewInv} onCollect={setCollectFor} />
          </div>
        </div>
      ) : (
        <BillTable rows={all} onView={setViewInv} onCollect={setCollectFor} />
      )}

      {collectFor && <CollectModal invoice={collectFor} onClose={() => setCollectFor(null)} onDone={() => { setCollectFor(null); load(); }} />}
      {viewInv && <InvoiceModal invoice={viewInv} onClose={() => setViewInv(null)} />}
    </div>
  );
}

function BillTable({ rows, onView, onCollect }) {
  return (
    <div className="border border-zinc-800 rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400">
          <tr><th className="text-left p-3">Date</th><th className="text-left p-3">Invoice</th><th className="text-left p-3">Player</th><th className="text-left p-3">Table</th><th className="text-right p-3">Total</th><th className="text-right p-3">Paid</th><th className="text-right p-3">Due</th><th className="text-left p-3">Status</th><th className="p-3"></th></tr>
        </thead>
        <tbody>
          {rows.map(i => (
            <tr key={i.id} className="border-t border-zinc-800" data-testid={`bill-row-${i.invoice_number}`}>
              <td className="p-3 whitespace-nowrap">{fmtDate(i.created_at)}</td>
              <td className="p-3 font-mono text-xs">{i.invoice_number}</td>
              <td className="p-3">{i.player_name || "—"}</td>
              <td className="p-3 text-zinc-400">{i.walk_in ? "Walk-in" : i.entries.map(e => e.table_name).join(" + ")}</td>
              <td className="p-3 text-right">{fmt(i.final_amount)}</td>
              <td className="p-3 text-right">{fmt(i.amount_paid)}</td>
              <td className="p-3 text-right text-[#F59E0B] font-semibold">{fmt(i.credit_amount)}</td>
              <td className={`p-3 uppercase text-xs font-bold ${STATUS_CLS[i.payment_status] || ""}`}>{i.payment_status}</td>
              <td className="p-3 whitespace-nowrap text-right">
                <Button size="sm" variant="outline" onClick={() => onView(i)} className="border-zinc-700 h-7 mr-1" data-testid={`bill-view-${i.invoice_number}`}>Details</Button>
                {i.credit_amount > 0 && <Button size="sm" onClick={() => onCollect(i)} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] h-7" data-testid={`bill-collect-${i.invoice_number}`}>Collect</Button>}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="9" className="text-center p-6 text-zinc-500">No bills</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function CollectModal({ invoice, onClose, onDone }) {
  const [amount, setAmount] = useState(invoice.credit_amount);
  const [method, setMethod] = useState("cash");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      await api.post(`/invoices/${invoice.id}/collect`, { amount: Number(amount), method, remarks });
      toast.success("Payment collected");
      onDone();
    } catch (e) { toast.error(apiErr(e)); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
        <DialogHeader><DialogTitle>Collect · {invoice.invoice_number}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm border border-zinc-800 rounded-md p-3 space-y-1">
            <div className="flex justify-between"><span className="text-zinc-400">Player</span><span>{invoice.player_name || "—"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Bill total</span><span>{fmt(invoice.final_amount)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Already paid</span><span>{fmt(invoice.amount_paid)}</span></div>
            <div className="flex justify-between font-bold"><span>Due</span><span className="text-[#F59E0B]" data-testid="collect-due">{fmt(invoice.credit_amount)}</span></div>
          </div>
          <div><Label className="text-zinc-400 text-xs uppercase tracking-widest">Amount</Label>
            <Input data-testid="collect-amount" type="number" min="0" max={invoice.credit_amount} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-zinc-900 border-zinc-800" /></div>
          <div><Label className="text-zinc-400 text-xs uppercase tracking-widest">Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger data-testid="collect-method" className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                <SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select></div>
          <div><Label className="text-zinc-400 text-xs uppercase tracking-widest">Remarks</Label>
            <Input data-testid="collect-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="bg-zinc-900 border-zinc-800" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-zinc-700" data-testid="collect-cancel">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="collect-save">Record Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
