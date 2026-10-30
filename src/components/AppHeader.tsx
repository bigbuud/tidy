import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api.functions";

export function AppHeader({ username }: { username: string }) {
  const navigate = useNavigate();
  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold">Logboek</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{username}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" /> Afmelden
          </Button>
        </div>
      </div>
    </header>
  );
}
