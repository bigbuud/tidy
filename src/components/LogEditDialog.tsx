import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateLog, type LogEntry } from "@/lib/api.functions";

const toForm = (l: LogEntry) => ({
  date: l.date,
  title: l.title,
  notes: l.notes,
  cost: l.cost != null ? String(l.cost).replace(".", ",") : "",
  mileage: l.mileage != null ? String(l.mileage) : "",
});

export function LogEditDialog({
  log,
  showMileage,
  onSaved,
}: {
  log: LogEntry;
  showMileage: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(toForm(log));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setF(toForm(log));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Log bewerken">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log bewerken</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const cost = f.cost.trim() ? Number(f.cost.trim().replace(",", ".")) : null;
            if (cost !== null && !Number.isFinite(cost)) {
              toast.error("Kost moet een getal zijn, bv. 125,50");
              return;
            }
            try {
              await updateLog({
                data: {
                  id: log.id,
                  date: f.date,
                  title: f.title,
                  notes: f.notes,
                  cost,
                  mileage: f.mileage ? Number(f.mileage) : null,
                },
              });
              setOpen(false);
              onSaved();
              toast.success("Log aangepast");
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="eld">Datum</Label>
              <Input
                id="eld"
                type="date"
                required
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="elt">Wat</Label>
              <Input
                id="elt"
                required
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="elc">Kost (€)</Label>
              <Input
                id="elc"
                inputMode="decimal"
                placeholder="0,00"
                value={f.cost}
                onChange={(e) => setF({ ...f, cost: e.target.value })}
              />
            </div>
            {(showMileage || f.mileage) && (
              <div className="space-y-1.5">
                <Label htmlFor="elm">Kilometerstand</Label>
                <Input
                  id="elm"
                  inputMode="numeric"
                  value={f.mileage}
                  onChange={(e) => setF({ ...f, mileage: e.target.value.replace(/\D/g, "") })}
                />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eln">Notities</Label>
            <Textarea
              id="eln"
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full">
            Opslaan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
