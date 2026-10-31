import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileText, Paperclip, Pencil, Trash2, Upload } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AssetDialog } from "@/components/AssetDialog";
import { LogEditDialog } from "@/components/LogEditDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addLog,
  deleteAsset,
  deleteDocument,
  deleteLog,
  getAsset,
  type Doc,
} from "@/lib/api.functions";
import { categoryOf, euro, fileSize } from "@/lib/categories";
import { requireAuth } from "@/lib/guard";

const assetQuery = (id: number) =>
  queryOptions({ queryKey: ["asset", id], queryFn: () => getAsset({ data: { id } }) });

export const Route = createFileRoute("/items/$id")({
  head: () => ({
    meta: [
      { title: "Item — Logboek" },
      { name: "description", content: "Onderhoudshistoriek en documenten van dit item." },
    ],
  }),
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    const assetId = Number(params.id);
    if (!Number.isInteger(assetId) || assetId <= 0) throw notFound();
    const d = await context.queryClient.ensureQueryData(assetQuery(assetId));
    if (!d) throw notFound();
  },
  component: ItemPage,
});

async function uploadFiles(assetId: number, files: ArrayLike<File>, logId?: number) {
  const fd = new FormData();
  fd.set("assetId", String(assetId));
  if (logId) fd.set("logId", String(logId));
  Array.from(files).forEach((f) => fd.append("files", f));
  const r = await fetch("/api/files", { method: "POST", body: fd });
  if (!r.ok) throw new Error(await r.text());
}

// Lokale datum (toISOString() geeft de UTC-datum: tussen middernacht en 1u/2u 's nachts dus "gisteren").
const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function ItemPage() {
  const { user } = Route.useRouteContext();
  const id = Number(Route.useParams().id);
  const { data } = useSuspenseQuery(assetQuery(id));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["asset", id] });
    qc.invalidateQueries({ queryKey: ["assets"] });
  };
  const [f, setF] = useState({ date: today(), title: "", notes: "", cost: "", mileage: "" });
  const [pending, setPending] = useState<FileList | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const generalRef = useRef<HTMLInputElement>(null);

  if (!data) return null;
  const { asset, logs, docs } = data;
  const cat = categoryOf(asset.category);
  const Icon = cat.icon;
  const showMileage = asset.category === "auto" || asset.category === "moto";
  const generalDocs = docs.filter((d) => !d.log_id);
  const total = logs.reduce((s, l) => s + (l.cost ?? 0), 0);

  return (
    <div className="min-h-screen">
      <AppHeader username={user.username} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Overzicht
        </Link>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Icon className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{cat.label}</p>
              <h1 className="text-4xl font-bold">{asset.name}</h1>
              {asset.description && (
                <p className="mt-1 max-w-xl whitespace-pre-line text-muted-foreground">
                  {asset.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <AssetDialog
              initial={asset}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4" /> Bewerken
                </Button>
              }
              onSaved={refresh}
            />
            <Button
              variant="outline"
              size="sm"
              aria-label="Item verwijderen"
              onClick={async () => {
                if (!confirm(`"${asset.name}" met alle logs en documenten verwijderen?`)) return;
                try {
                  await deleteAsset({ data: { id } });
                  qc.invalidateQueries({ queryKey: ["assets"] });
                  navigate({ to: "/" });
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <section>
            <form
              className="mb-8 space-y-3 rounded-lg border bg-card p-5 shadow-card"
              onSubmit={async (e) => {
                e.preventDefault();
                const cost = f.cost.trim() ? Number(f.cost.trim().replace(",", ".")) : null;
                if (cost !== null && !Number.isFinite(cost)) {
                  toast.error("Kost moet een getal zijn, bv. 125,50");
                  return;
                }
                let logId: number;
                try {
                  const r = await addLog({
                    data: {
                      assetId: id,
                      date: f.date,
                      title: f.title,
                      notes: f.notes,
                      cost,
                      mileage: f.mileage ? Number(f.mileage) : null,
                    },
                  });
                  logId = r.id;
                } catch (err) {
                  toast.error((err as Error).message);
                  return;
                }
                // De log staat nu in de database: formulier altijd leegmaken, ook als de upload faalt,
                // anders kan een nieuwe poging dezelfde log dubbel opslaan.
                const toUpload = pending ? Array.from(pending) : []; // kopie: FileList wordt leeg bij value = ""
                setF({ date: today(), title: "", notes: "", cost: "", mileage: "" });
                setPending(null);
                if (fileRef.current) fileRef.current.value = "";
                if (toUpload.length) {
                  try {
                    await uploadFiles(id, toUpload, logId);
                  } catch (err) {
                    refresh();
                    toast.error(`Log opgeslagen, maar upload mislukt: ${(err as Error).message}`);
                    return;
                  }
                }
                refresh();
                toast.success("Log toegevoegd");
              }}
            >
              <h2 className="text-xl font-bold">Nieuwe log</h2>
              <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor="ld">Datum</Label>
                  <Input
                    id="ld"
                    type="date"
                    required
                    value={f.date}
                    onChange={(e) => setF({ ...f, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lt">Wat</Label>
                  <Input
                    id="lt"
                    required
                    placeholder="bv. Grote onderhoudsbeurt"
                    value={f.title}
                    onChange={(e) => setF({ ...f, title: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lc">Kost (€)</Label>
                  <Input
                    id="lc"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={f.cost}
                    onChange={(e) => setF({ ...f, cost: e.target.value })}
                  />
                </div>
                {showMileage && (
                  <div className="space-y-1.5">
                    <Label htmlFor="lm">Kilometerstand</Label>
                    <Input
                      id="lm"
                      inputMode="numeric"
                      value={f.mileage}
                      onChange={(e) => setF({ ...f, mileage: e.target.value.replace(/\D/g, "") })}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Notities</Label>
                <Textarea
                  id="ln"
                  value={f.notes}
                  onChange={(e) => setF({ ...f, notes: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-4 w-4" />
                  {pending?.length
                    ? `${pending.length} bestand(en) gekozen`
                    : "Factuur / bewijs bijvoegen"}
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => setPending(e.target.files)}
                  />
                </label>
                <Button type="submit">Log opslaan</Button>
              </div>
            </form>

            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-2xl font-bold">Historiek</h2>
              <span className="font-mono text-sm text-muted-foreground">totaal {euro(total)}</span>
            </div>
            {logs.length === 0 ? (
              <p className="text-muted-foreground">Nog geen logs.</p>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-primary/30 pl-6">
                {logs.map((l) => (
                  <li key={l.id} className="relative">
                    <span className="absolute -left-[31px] top-5 h-3 w-3 rounded-full border-2 border-card bg-accent" />
                    <div className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">
                            {l.date}
                            {l.mileage != null && ` · ${l.mileage.toLocaleString("nl-BE")} km`}
                          </p>
                          <h3 className="text-lg font-bold">{l.title}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          {l.cost != null && (
                            <span className="font-mono text-sm">{euro(l.cost)}</span>
                          )}
                          <LogEditDialog log={l} showMileage={showMileage} onSaved={refresh} />
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Log verwijderen"
                            onClick={async () => {
                              if (!confirm("Deze log verwijderen?")) return;
                              try {
                                await deleteLog({ data: { id: l.id } });
                                refresh();
                              } catch (err) {
                                toast.error((err as Error).message);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {l.notes && <p className="mt-2 whitespace-pre-line text-sm">{l.notes}</p>}
                      <DocList docs={docs.filter((d) => d.log_id === l.id)} onChange={refresh} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <aside>
            <div className="rounded-lg border bg-card p-5 shadow-card">
              <h2 className="text-xl font-bold">Algemene documenten</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Aankoopbewijs, garantie, handleiding…
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => generalRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> Uploaden
              </Button>
              <input
                ref={generalRef}
                type="file"
                multiple
                className="sr-only"
                onChange={async (e) => {
                  if (!e.target.files?.length) return;
                  try {
                    await uploadFiles(id, e.target.files);
                    refresh();
                    toast.success("Geüpload");
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                  e.target.value = "";
                }}
              />
              <DocList docs={generalDocs} onChange={refresh} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function DocList({ docs, onChange }: { docs: Doc[]; onChange: () => void }) {
  if (!docs.length) return null;
  return (
    <ul className="mt-3 space-y-1 border-t pt-3">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <a
            href={`/api/files/${d.id}`}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate hover:underline"
          >
            {d.filename}
          </a>
          <span className="font-mono text-xs text-muted-foreground">{fileSize(d.size)}</span>
          <button
            aria-label="Document verwijderen"
            className="text-muted-foreground hover:text-destructive"
            onClick={async () => {
              if (!confirm(`${d.filename} verwijderen?`)) return;
              try {
                await deleteDocument({ data: { id: d.id } });
                onChange();
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
