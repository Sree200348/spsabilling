import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiErr } from "@/api";
import { toast } from "sonner";

export default function SwitchTableModal({ session, tables, sessions, onClose, onDone }) {
  const [target, setTarget] = useState("");
  const busy = new Set(sessions.filter(s => s.status !== "closed").map(s => s.current_table_id));
  const available = tables.filter(t => !busy.has(t.id));

  async function submit() {
    if (!target) return toast.error("Select a table");
    try {
      await api.post(`/sessions/${session.id}/switch`, { new_table_id: target });
      toast.success("Table switched");
      onDone();
    } catch (e) { toast.error(apiErr(e)); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
        <DialogHeader><DialogTitle>Switch Table</DialogTitle></DialogHeader>
        <p className="text-sm text-zinc-400">Current session and snacks will be preserved. Billing continues on the new table from switch time.</p>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger data-testid="switch-target-select" className="bg-zinc-900 border-zinc-800"><SelectValue placeholder="Select available table" /></SelectTrigger>
          <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
            {available.map(t => <SelectItem key={t.id} value={t.id}>{t.name} · ₹{t.hourly_rate}/hr</SelectItem>)}
            {!available.length && <div className="p-3 text-sm text-zinc-500">No free tables</div>}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-zinc-700" data-testid="switch-cancel-btn">Cancel</Button>
          <Button onClick={submit} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="switch-confirm-btn">Switch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
