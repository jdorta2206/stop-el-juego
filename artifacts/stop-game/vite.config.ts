import { defineConfig } from "vite";
import type { Connect, PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

// Sirve /.well-known/assetlinks.json directamente, sin pasar por el fallback SPA.
// Necesario porque algunos servidores estáticos (p.ej. `vite preview`) no entregan
// archivos dentro de carpetas que empiezan por punto, y Android necesita ese archivo
// para verificar la TWA y mostrarla a pantalla completa (sin la barra del navegador).
function wellKnownAssetlinks(): PluginOption {
  const filePath = path.resolve(
    import.meta.dirname,
    "public/.well-known/assetlinks.json"
  );
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = (req.url || "").split("?")[0];
    if (url === "/.well-known/assetlinks.json") {
      try {
        const data = fs.readFileSync(filePath, "utf-8");
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.end(data);
        return;
      } catch {
        // si no existe, seguimos con el flujo normal
      }
    }
    next();
  };
  return {
    name: "serve-well-known-assetlinks",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

const isBuild = process.env.NODE_ENV === "production" || process.argv.includes("build");

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;

if (!isBuild && rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";

const replitPlugins =
  !isBuild && process.env.REPL_ID !== undefined
    ? [
        await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
          m.default()
        ),
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({
            root: path.resolve(import.meta.dirname, ".."),
          })
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) =>
          m.devBanner()
        ),
      ]
    : [];

// ⚡ TIMESTAMP FIJO PARA FORZAR CACHÉ (cámbialo en cada despliegue para forzar una nueva versión)
// Usa el formato AAAAMMDD (ej: 20260623 para el 23 de junio de 2026)
const buildTimestamp = 20260623;

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), wellKnownAssetlinks(), ...replitPlugins],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Añadimos el timestamp al nombre de los archivos para forzar cache-busting
        entryFileNames: `assets/[name].[hash].${buildTimestamp}.js`,
        chunkFileNames: `assets/[name].[hash].${buildTimestamp}.js`,
        assetFileNames: `assets/[name].[hash].[ext]`,
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});