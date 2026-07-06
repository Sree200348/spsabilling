import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { fmt, fmtDate, fmtDuration } from "@/utils";
import { useEffect, useState } from "react";
import { api } from "@/api";
import { Printer, X } from "lucide-react";

export default function InvoiceModal({ invoice, onClose }) {
  const [settings, setSettings] = useState({ business_name: "South Point Snooker Academy", currency: "₹", invoice_footer: "Thank you!" });
  useEffect(() => { api.get("/settings").then(r => setSettings(r.data)).catch(() => {}); }, []);

  function doPrint() { window.print(); }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-white text-black max-w-md p-0 gap-0 print:shadow-none print:max-w-none print:m-0">
        <VisuallyHidden><DialogTitle>Invoice {invoice.invoice_number}</DialogTitle></VisuallyHidden>
        <div className="flex items-center justify-between p-3 border-b bg-zinc-100 print:hidden">
          <div className="font-semibold text-sm">Invoice Preview</div>
          <div className="flex gap-2">
            <Button size="sm" onClick={doPrint} className="bg-[#10B981] text-white hover:bg-[#059669]" data-testid="invoice-print-btn"><Printer size={14} className="mr-1"/> Print</Button>
            <Button size="sm" variant="outline" onClick={onClose} data-testid="invoice-close-btn"><X size={14}/></Button>
          </div>
        </div>
        <div id="invoice-print" className="p-6 text-sm">
          <div className="text-center mb-4">
            <div className="font-black text-xl tracking-tight">{settings.business_name}</div>
            {settings.address && <div className="text-xs">{settings.address}</div>}
            {settings.phone && <div className="text-xs">{settings.phone}</div>}
          </div>
          <div className="border-t border-dashed border-black pt-2 mb-2 text-xs">
            <div className="flex justify-between"><span>Invoice</span><span className="font-mono">{invoice.invoice_number}</span></div>
            <div className="flex justify-between"><span>Date</span><span>{fmtDate(invoice.created_at)}</span></div>
            <div className="flex justify-between"><span>Player</span><span>{invoice.player_name || "-"}</span></div>
            {invoice.player_mobile && <div className="flex justify-between"><span>Mobile</span><span>{invoice.player_mobile}</span></div>}
          </div>
          <div className="border-t border-dashed border-black pt-2 mb-2">
            <div className="font-bold text-xs uppercase mb-1">Table Sessions</div>
            {invoice.entries.map((e) => (
              <div key={`${e.table_id}-${e.start_time}`} className="mb-1">
                <div className="flex justify-between"><span>{e.table_name}</span><span>{settings.currency}{e.amount.toFixed(2)}</span></div>
                <div className="text-[10px] text-zinc-600">{fmtDuration(e.billable_seconds)} @ {settings.currency}{e.hourly_rate}/hr</div>
              </div>
            ))}
          </div>
          {invoice.snacks?.length > 0 && (
            <div className="border-t border-dashed border-black pt-2 mb-2">
              <div className="font-bold text-xs uppercase mb-1">Snacks</div>
              {invoice.snacks.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>{s.name} × {s.qty}</span>
                  <span>{settings.currency}{s.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          {invoice.per_player && invoice.per_player.length > 1 && (
            <div className="border-t border-dashed border-black pt-2 mb-2">
              <div className="font-bold text-xs uppercase mb-1">Per-Player Split</div>
              {invoice.per_player.map((pp) => (
                <div key={pp.player_local_id} className="mb-1">
                  <div className="flex justify-between font-semibold"><span>{pp.name} ({pp.share_percent}%)</span><span>{fmt(pp.subtotal)}</span></div>
                  <div className="text-[10px] text-zinc-600 flex justify-between"><span>Table {fmt(pp.table_share)} · Snacks {fmt(pp.snacks_share)}</span></div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-dashed border-black pt-2 space-y-1">
            <Ln k="Table amount" v={fmt(invoice.table_amount)} />
            <Ln k="Snacks total" v={fmt(invoice.snacks_total)} />
            {invoice.membership_discount > 0 && <Ln k={`${invoice.membership_name} (${invoice.membership_percent}%)`} v={`- ${fmt(invoice.membership_discount)}`} />}
            {invoice.snacks_discount > 0 && <Ln k="Snacks discount" v={`- ${fmt(invoice.snacks_discount)}`} />}
            {invoice.manual_discount > 0 && <Ln k="Manual discount" v={`- ${fmt(invoice.manual_discount)}`} />}
            <div className="border-t border-black my-1"></div>
            <Ln k="TOTAL" v={fmt(invoice.final_amount)} bold />
            <Ln k="Paid" v={fmt(invoice.amount_paid)} />
            {invoice.credit_amount > 0 && <Ln k="Credit / Balance" v={fmt(invoice.credit_amount)} bold />}
          </div>
          {invoice.payments?.length > 0 && (
            <div className="border-t border-dashed border-black pt-2 mt-2 text-xs">
              <div className="font-bold uppercase mb-1">Payments</div>
              {invoice.payments.map((p) => (
                <div key={`${p.method}-${p.amount}`} className="flex justify-between"><span>{p.method.toUpperCase()}</span><span>{fmt(p.amount)}</span></div>
              ))}
            </div>
          )}
          <div className="text-center text-xs mt-3 border-t border-dashed border-black pt-2">
            {settings.invoice_footer}
          </div>
        </div>
        <style>{`@media print { body * { visibility: hidden; } #invoice-print, #invoice-print * { visibility: visible; } #invoice-print { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      </DialogContent>
    </Dialog>
  );
}

function Ln({ k, v, bold }) {
  return <div className={`flex justify-between ${bold ? "font-bold text-base" : ""}`}><span>{k}</span><span>{v}</span></div>;
}
