import { useState, type ReactNode } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveAsset } from "@/lib/api.functions";
import { CATEGORIES } from "@/lib/categories";

type Initial = { id?: number; name: string; category: string; description: string };

export function AssetDialog({
  trigger,
  initial,
  onSaved,
}: {
  trigger: ReactNode;
  initial?: Initial;
  onSaved: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Initial>(initial ?? { name: "", category: "auto", description: "" });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setF(initial ?? { name: "", category: "auto", description: "" });
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Bewerken" : "Nieuw item"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await saveAsset({ data: f });
              setOpen(false);
              onSaved(r.id);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="an">Naam</Label>
            <Input
              id="an"
              required
              placeholder="bv. VW Golf 1-ABC-123"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categorie</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad">Omschrijving</Label>
            <Textarea
              id="ad"
              placeholder="Bouwjaar, serienummer, garantie…"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
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
