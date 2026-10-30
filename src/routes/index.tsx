import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AssetDialog } from "@/components/AssetDialog";
import { Button } from "@/components/ui/button";
import { listAssets } from "@/lib/api.functions";
import { CATEGORIES, categoryOf, euro } from "@/lib/categories";
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

  return (
    <div className="min-h-screen">
      <AppHeader username={user.username} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Overzicht</h1>
            <p className="text-muted-foreground">{assets.length} items in je logboek</p>
          </div>
          <AssetDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> Nieuw item
              </Button>
            }
            onSaved={(id) => navigate({ to: "/items/$id", params: { id: String(id) } })}
          />
        </div>

        {used.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
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
          <div className="rounded-lg border border-dashed bg-card p-12 text-center">
            <h2 className="text-2xl font-bold">Nog niets bijgehouden</h2>
            <p className="mt-2 text-muted-foreground">
              Voeg je auto, moto, verwarming of huis toe om te beginnen.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((a) => {
              const cat = categoryOf(a.category);
              const Icon = cat.icon;
              return (
                <Link
                  key={a.id}
                  to="/items/$id"
                  params={{ id: String(a.id) }}
                  className="group rounded-lg border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary"
                >
                  <div className="flex items-start justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary group-hover:bg-accent group-hover:text-accent-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {cat.label}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{a.name}</h3>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 font-mono text-xs">
                    <div>
                      <dt className="text-muted-foreground">Logs</dt>
                      <dd>{a.log_count}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Laatst</dt>
                      <dd>{a.last_date ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Totaal</dt>
                      <dd>{euro(a.total_cost) || "—"}</dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
          </div>
        )}
      </main>
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
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card hover:border-primary",
      )}
    >
      {children}
    </button>
  );
}
