import { defineConfig } from "vite";
import type { Connect, PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

// Sirve /.well-known/assetlinks.json
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
        // si no existe, seguir
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
        await import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({
            root: path.resolve(import.meta.dirname, ".."),
          })
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
      ]
    : [];

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
  // root: eliminado → Vite usa el directorio actual (artifacts/stop-game)
  build: {
    outDir: "dist", // ahora los archivos van a artifacts/stop-game/dist
    emptyOutDir: true,
    rollupOptions: {
      output: {
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