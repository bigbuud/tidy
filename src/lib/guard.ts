import { redirect } from "@tanstack/react-router";
import { getAuthState } from "./api.functions";

/** Use in beforeLoad of every private page. Session lives in an httpOnly cookie, so this works during SSR too. */
export async function requireAuth() {
  const s = await getAuthState();
  if (s.setupNeeded) throw redirect({ to: "/setup" });
  if (!s.user) throw redirect({ to: "/login" });
  return { user: s.user };
}
