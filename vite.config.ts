import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

const baseHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=15552000",
};

// 'unsafe-inline' voor scripts is nodig omdat de server de eerste pagina als inline script meegeeft.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export default defineConfig(({ command }) => ({
  server: { host: "::", port: 8080 },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Zelfstandige Node-server (.output/server/index.mjs), bedoeld voor Docker.
    ...(command === "build"
      ? [
          nitro({
            preset: "node-server",
            routeRules: {
              "/**": { headers: baseHeaders },
              // Alleen de pagina's krijgen een CSP, zodat PDF's en afbeeldingen uit /api/files gewoon openen.
              "/": { headers: { "content-security-policy": csp } },
              "/login": { headers: { "content-security-policy": csp } },
              "/setup": { headers: { "content-security-policy": csp } },
              "/items/**": { headers: { "content-security-policy": csp } },
            },
          }),
        ]
      : []),
    viteReact(),
  ],
}));
