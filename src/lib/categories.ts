import { Bike, Car, Flame, Home, Package, Plug, Trees, type LucideIcon } from "lucide-react";

export const CATEGORIES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "auto", label: "Auto", icon: Car },
  { value: "moto", label: "Moto", icon: Bike },
  { value: "verwarming", label: "Verwarming", icon: Flame },
  { value: "huis", label: "Huis", icon: Home },
  { value: "tuin", label: "Tuin", icon: Trees },
  { value: "toestel", label: "Toestel", icon: Plug },
  { value: "overig", label: "Overig", icon: Package },
];

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [string, ...string[]];

const FALLBACK_CATEGORY = { value: "overig", label: "Overig", icon: Package };

export const categoryOf = (v: string) => CATEGORIES.find((c) => c.value === v) ?? FALLBACK_CATEGORY;

export const euro = (n: number | null | undefined) =>
  n == null ? "" : new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

export const fileSize = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1048576
      ? `${(b / 1024).toFixed(0)} KB`
      : `${(b / 1048576).toFixed(1)} MB`;
