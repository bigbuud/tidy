import { Bike, Car, Flame, Home, Package, Plug, Trees, type LucideIcon } from "lucide-react";

export const CATEGORIES: { value: string; label: string; icon: LucideIcon; tone: string }[] = [
  {
    value: "auto",
    label: "Auto",
    icon: Car,
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    value: "moto",
    label: "Moto",
    icon: Bike,
    tone: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  },
  {
    value: "verwarming",
    label: "Verwarming",
    icon: Flame,
    tone: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  {
    value: "huis",
    label: "Huis",
    icon: Home,
    tone: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  },
  {
    value: "tuin",
    label: "Tuin",
    icon: Trees,
    tone: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  },
  {
    value: "toestel",
    label: "Toestel",
    icon: Plug,
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    value: "overig",
    label: "Overig",
    icon: Package,
    tone: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  },
];

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [string, ...string[]];

const FALLBACK_CATEGORY = CATEGORIES[CATEGORIES.length - 1]!;

export const categoryOf = (v: string) => CATEGORIES.find((c) => c.value === v) ?? FALLBACK_CATEGORY;

export const euro = (n: number | null | undefined) =>
  n == null ? "" : new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

export const fileSize = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1048576
      ? `${(b / 1024).toFixed(0)} KB`
      : `${(b / 1048576).toFixed(1)} MB`;

const parseDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d);
};

/** "16 apr. 2026" */
export const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", year: "numeric" }).format(
        parseDay(iso),
      )
    : "";

/** "16 apr." */
export const fmtDayMonth = (iso: string) =>
  new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" }).format(parseDay(iso));

export const fmtKm = (km: number) => `${km.toLocaleString("nl-BE")} km`;
