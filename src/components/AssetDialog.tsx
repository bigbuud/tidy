import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AssetAvatar } from "@/components/AssetAvatar";
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
import { removePhoto, saveAsset } from "@/lib/api.functions";
import { CATEGORIES } from "@/lib/categories";
import { uploadPhoto } from "@/lib/image";

type Initial = {
  id?: number;
  name: string;
  category: string;
  description: string;
  photo_v?: number | null;
};

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
  const [photo, setPhoto] = useState<File | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);
  const hasPhoto = !!preview || (!!initial?.photo_v && !dropPhoto);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setF(initial ?? { name: "", category: "auto", description: "" });
          setPhoto(null);
          setDropPhoto(false);
        }
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
              const r = await saveAsset({
                data: {
                  ...(f.id ? { id: f.id } : {}),
                  name: f.name,
                  category: f.category,
                  description: f.description,
                },
              });
              setOpen(false);
              try {
                if (photo) await uploadPhoto(r.id, photo);
                else if (dropPhoto && initial?.photo_v) await removePhoto({ data: { id: r.id } });
              } catch (err) {
                toast.error(`Item opgeslagen, maar de foto niet: ${(err as Error).message}`);
              }
              onSaved(r.id);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <div className="flex items-center gap-4">
            {preview ? (
              <img src={preview} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
            ) : (
              <AssetAvatar
                id={f.id ?? 0}
                category={f.category}
                photoV={dropPhoto ? null : initial?.photo_v}
                className="size-20 rounded-2xl"
                iconClassName="size-8"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-accent">
                <Camera className="size-4" />
                {hasPhoto ? "Andere foto" : "Foto toevoegen"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label="Foto kiezen"
                  onChange={(e) => {
                    setPhoto(e.target.files?.[0] ?? null);
                    setDropPhoto(false);
                    e.target.value = "";
                  }}
                />
              </label>
              {hasPhoto && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhoto(null);
                    setDropPhoto(true);
                  }}
                >
                  <Trash2 className="size-4" /> Verwijderen
                </Button>
              )}
            </div>
          </div>
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
