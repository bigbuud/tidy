import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-xl bg-signal text-signal-foreground">
            <BookOpen className="size-6" />
          </span>
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-2xl border bg-card p-6">{children}</div>
      </div>
    </div>
  );
}
