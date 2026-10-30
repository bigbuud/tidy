import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthState, login } from "@/lib/api.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Aanmelden — Logboek" },
      { name: "description", content: "Meld je aan bij je persoonlijke onderhoudslogboek." },
    ],
  }),
  beforeLoad: async () => {
    const s = await getAuthState();
    if (s.setupNeeded) throw redirect({ to: "/setup" });
    if (s.user) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ username: "", password: "", code: "" });

  return (
    <AuthShell title="Aanmelden" subtitle="Wachtwoord + code uit je authenticator-app">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await login({ data: f });
            navigate({ to: "/" });
          } catch (err) {
            toast.error((err as Error).message);
            setF((x) => ({ ...x, code: "" }));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="u">Gebruikersnaam</Label>
          <Input
            id="u"
            autoComplete="username"
            required
            value={f.username}
            onChange={(e) => setF({ ...f, username: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p">Wachtwoord</Label>
          <Input
            id="p"
            type="password"
            autoComplete="current-password"
            required
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c">Verificatiecode</Label>
          <Input
            id="c"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            required
            className="font-mono tracking-[0.4em]"
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, "") })}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Bezig…" : "Aanmelden"}
        </Button>
      </form>
    </AuthShell>
  );
}
