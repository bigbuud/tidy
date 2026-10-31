import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, ChevronRight, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AssetDialog } from "@/components/AssetDialog";
import { Button } from "@/components/ui/button";
import { listAssets } from "@/lib/api.functions";
import { CATEGORIES, categoryOf, euro, fmtDate } from "@/lib/categories";
import { requireAuth } from "@/lib/guard";
import { cn } from "@/lib/utils";

export const assetsQuery = queryOptions({ queryKey: ["assets"], queryFn: () => listAssets() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overzicht — Logboek" },
      { name: "description", content: "Al je voertuigen, toestellen en onderhoud op één plek." },
    ],
  }),
  beforeLoad: requireAuth,
  loader: ({ context }) => context.queryClient.ensureQueryData(assetsQuery),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const { data: assets } = useSuspenseQuery(assetsQuery);
  const [filter, setFilter] = useState<string | null>(null);
  const navigate = useNavigate();
  const shown = filter ? assets.filter((a) => a.category === filter) : assets;
  const used = CATEGORIES.filter((c) => assets.some((a) => a.category === c.value));
  const totalCost = assets.reduce((s, a) => s + (a.total_cost ?? 0), 0);
  const totalLogs = assets.reduce((s, a) => s + a.log_count, 0);

  return (
    <div className="min-h-screen">
      <AppHeader username={user.username} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Overzicht</h1>
          <AssetDialog
            trigger={
              <Button>
                <Plus className="size-4" /> Nieuw item
              </Button>
            }
            onSaved={(id) => navigate({ to: "/items/$id", params: { id: String(id) } })}
          />
        </div>

        {assets.length > 0 && (
          <dl className="mb-6 grid grid-cols-3 divide-x rounded-2xl border bg-card">
            <Stat label="Items" value={String(assets.length)} />
            <Stat label="Logs" value={String(totalLogs)} />
            <Stat label="Totaal uitgegeven" value={euro(totalCost)} />
          </dl>
        )}

        {used.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterChip active={!filter} onClick={() => setFilter(null)}>
              Alles
            </FilterChip>
            {used.map((c) => (
              <FilterChip
                key={c.value}
                active={filter === c.value}
                onClick={() => setFilter(c.value)}
              >
                {c.label}
              </FilterChip>
            ))}
          </div>
        )}

        {assets.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-secondary text-muted-foreground">
              <BookOpen className="size-6" />
            </span>
            <h2 className="font-display text-xl font-bold">Nog geen items</h2>
            <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
              Voeg een auto, moto, verwarming of toestel toe om het onderhoud bij te houden.
            </p>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {shown.map((a) => {
              const cat = categoryOf(a.category);
              const Icon = cat.icon;
              return (
                <li key={a.id}>
                  <Link
                    to="/items/$id"
                    params={{ id: String(a.id) }}
                    className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none sm:px-5"
                  >
                    <span
                      className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-xl",
                        cat.tone,
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold tracking-tight">{a.name}</h3>
                      <p className="text-sm text-muted-foreground">{cat.label}</p>
                      <p className="text-sm tabular-nums text-muted-foreground sm:hidden">
                        {a.last_date
                          ? `${fmtDate(a.last_date)}${a.total_cost ? `, ${euro(a.total_cost)}` : ""}`
                          : "Nog geen logs"}
                      </p>
                    </div>
                    <dl className="hidden items-center gap-8 text-sm tabular-nums sm:flex">
                      <Cell label="Laatste log" className="w-28">
                        {a.last_date ? fmtDate(a.last_date) : "—"}
                      </Cell>
                      <Cell label="Logs" className="w-10">
                        {a.log_count}
                      </Cell>
                      <Cell label="Totaal" className="w-24">
                        {euro(a.total_cost) || "—"}
                      </Cell>
                    </dl>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
      <dd className="font-display text-xl font-semibold tabular-nums sm:text-2xl">{value}</dd>
    </div>
  );
}

function Cell({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("text-right", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:border-input hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
