import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api.functions";

export function AppHeader({ username }: { username: string }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-signal text-signal-foreground">
            <BookOpen className="size-[18px]" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Logboek</span>
        </Link>
        <div className="flex items-center gap-1">
          <span className="hidden pr-2 text-sm text-muted-foreground sm:inline">{username}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="size-4" /> Afmelden
          </Button>
        </div>
      </div>
    </header>
  );
}
