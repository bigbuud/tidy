import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Paperclip, Pencil, Trash2, Upload } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AssetDialog } from "@/components/AssetDialog";
import { DocList } from "@/components/DocList";
import { LogEditDialog } from "@/components/LogEditDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addLog, deleteAsset, deleteLog, getAsset } from "@/lib/api.functions";
import { categoryOf, euro, fmtDayMonth, fmtKm } from "@/lib/categories";
import { requireAuth } from "@/lib/guard";
import { uploadFiles } from "@/lib/uploads";
import { cn } from "@/lib/utils";

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

// Lokale datum (toISOString() geeft de UTC-datum: tussen middernacht en 1u/2u 's nachts dus "gisteren").
const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const emptyForm = () => ({ date: today(), title: "", notes: "", cost: "", mileage: "" });

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
  const [f, setF] = useState(emptyForm());
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
  const lastKm = logs.find((l) => l.mileage != null)?.mileage ?? null;

  return (
    <div className="min-h-screen">
      <AppHeader username={user.username} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Overzicht
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", cat.tone)}>
              <Icon className="size-7" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold sm:text-4xl">{asset.name}</h1>
              <p className="text-sm text-muted-foreground">{cat.label}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AssetDialog
              initial={asset}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" /> Bewerken
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
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {asset.description && (
          <p className="mb-6 max-w-2xl whitespace-pre-line text-muted-foreground">
            {asset.description}
          </p>
        )}

        <dl
          className={cn(
            "mb-8 grid divide-x rounded-2xl border bg-card",
            lastKm != null ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          <div className="px-4 py-3.5 sm:px-5">
            <dt className="text-xs text-muted-foreground sm:text-sm">Totaal uitgegeven</dt>
            <dd className="font-display text-xl font-semibold tabular-nums sm:text-2xl">
              {euro(total)}
            </dd>
          </div>
          <div className="px-4 py-3.5 sm:px-5">
            <dt className="text-xs text-muted-foreground sm:text-sm">Logs</dt>
            <dd className="font-display text-xl font-semibold tabular-nums sm:text-2xl">
              {logs.length}
            </dd>
          </div>
          {lastKm != null && (
            <div className="px-4 py-3.5 sm:px-5">
              <dt className="text-xs text-muted-foreground sm:text-sm">Laatste kilometerstand</dt>
              <dd className="font-display text-xl font-semibold tabular-nums sm:text-2xl">
                {fmtKm(lastKm)}
              </dd>
            </div>
          )}
        </dl>

        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <section className="min-w-0">
            <form
              className="mb-10 space-y-4 rounded-2xl border bg-card p-5"
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
                setF(emptyForm());
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
              <h2 className="font-display text-lg font-semibold">Nieuwe log</h2>
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
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
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground">
                  <Paperclip className="size-4" />
                  {pending?.length
                    ? `${pending.length} bestand(en) gekozen`
                    : "Factuur of bewijs bijvoegen"}
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

            <h2 className="mb-4 font-display text-xl font-semibold">Historiek</h2>
            {logs.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-card px-5 py-8 text-center text-muted-foreground">
                Nog geen logs. Voeg hierboven de eerste toe.
              </p>
            ) : (
              <ol className="space-y-3">
                {logs.map((l) => (
                  <li
                    key={l.id}
                    className="grid grid-cols-[4.25rem_1fr] gap-3 sm:grid-cols-[6rem_1fr] sm:gap-5"
                  >
                    <div className="pt-4 text-right">
                      <p className="font-display text-base font-semibold leading-tight sm:text-lg">
                        {fmtDayMonth(l.date)}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {l.date.slice(0, 4)}
                      </p>
                      {l.mileage != null && (
                        <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                          {fmtKm(l.mileage)}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0 rounded-2xl border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold">{l.title}</h3>
                          {l.cost != null && (
                            <p className="text-sm font-medium tabular-nums text-muted-foreground">
                              {euro(l.cost)}
                            </p>
                          )}
                        </div>
                        <div className="-mr-1 -mt-1 flex shrink-0 items-center">
                          <LogEditDialog
                            log={l}
                            assetId={id}
                            docs={docs.filter((d) => d.log_id === l.id)}
                            showMileage={showMileage}
                            onSaved={refresh}
                          />
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
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      {l.notes && (
                        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                          {l.notes}
                        </p>
                      )}
                      <DocList
                        className="mt-3"
                        docs={docs.filter((d) => d.log_id === l.id)}
                        onChange={refresh}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-display text-lg font-semibold">Algemene documenten</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Aankoopbewijs, garantie, handleiding…
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => generalRef.current?.click()}
              >
                <Upload className="size-4" /> Uploaden
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
              <DocList className="mt-4" docs={generalDocs} onChange={refresh} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
