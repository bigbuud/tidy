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
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="h-6 w-6" />
          </span>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-card">{children}</div>
      </div>
    </div>
  );
}
