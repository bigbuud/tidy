import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthState, setupComplete, setupInit } from "@/lib/api.functions";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Eerste configuratie — Logboek" },
      { name: "description", content: "Maak je account aan en stel tweestapsverificatie in." },
    ],
  }),
  beforeLoad: async () => {
    const s = await getAuthState();
    if (!s.setupNeeded) throw redirect({ to: "/login" });
  },
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ username: "", password: "", confirm: "", code: "" });
  const [totp, setTotp] = useState<{ secret: string; qr: string } | null>(null);

  if (!totp) {
    return (
      <AuthShell title="Welkom" subtitle="Stap 1 van 2 — maak je account aan">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (f.password.length < 10) {
              toast.error("Wachtwoord moet minstens 10 tekens zijn");
              return;
            }
            if (f.password !== f.confirm) {
              toast.error("Wachtwoorden komen niet overeen");
              return;
            }
            setBusy(true);
            try {
              setTotp(await setupInit({ data: { username: f.username.trim() } }));
            } catch (err) {
              toast.error((err as Error).message);
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
            <Label htmlFor="p">Wachtwoord (min. 10 tekens)</Label>
            <Input
              id="p"
              type="password"
              autoComplete="new-password"
              required
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p2">Herhaal wachtwoord</Label>
            <Input
              id="p2"
              type="password"
              autoComplete="new-password"
              required
              value={f.confirm}
              onChange={(e) => setF({ ...f, confirm: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Volgende
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Tweestapsverificatie" subtitle="Stap 2 van 2 — scan met je authenticator-app">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await setupComplete({
              data: {
                username: f.username.trim(),
                password: f.password,
                secret: totp.secret,
                code: f.code,
              },
            });
            toast.success("Account aangemaakt");
            navigate({ to: "/" });
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <img
          src={totp.qr}
          alt="QR-code voor authenticator-app"
          className="mx-auto rounded-md border bg-card"
          width={200}
          height={200}
        />
        <p className="text-center text-xs text-muted-foreground">
          Of voer manueel in:
          <br />
          <code className="font-mono text-foreground break-all">{totp.secret}</code>
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="c">Code uit de app</Label>
          <Input
            id="c"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className="font-mono tracking-[0.4em]"
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, "") })}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          Account activeren
        </Button>
      </form>
    </AuthShell>
  );
}
