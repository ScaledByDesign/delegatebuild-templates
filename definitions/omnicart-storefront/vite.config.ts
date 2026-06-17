// Custom Vite config for omnicart-storefront - injects standard environment variables to browser
import { defineConfig, loadEnv } from "vite";
import path from "path";
import fs from "node:fs";
import react from "@vitejs/plugin-react";
import { exec } from "node:child_process";
import pino from "pino";
import { cloudflare } from "@cloudflare/vite-plugin";

const logger = pino();

const stripAnsi = (str: string) =>
  str.replace(
    // eslint-disable-next-line no-control-regex -- Allow ANSI escape stripping
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );

const LOG_MESSAGE_BOUNDARY = /\n(?=\[[A-Z][^\]]*\])/g;

const emitLog = (level: "info" | "warn" | "error", rawMessage: string) => {
  const cleaned = stripAnsi(rawMessage).replace(/\r\n/g, "\n");
  const parts = cleaned
    .split(LOG_MESSAGE_BOUNDARY)
    .map((part) => part.trimEnd())
    .filter((part) => part.trim().length > 0);

  if (parts.length === 0) {
    logger[level](cleaned.trimEnd());
    return;
  }

  for (const part of parts) {
    logger[level](part);
  }
};

const customLogger = {
  warnOnce: (msg: string) => emitLog("warn", msg),
  info: (msg: string) => emitLog("info", msg),
  warn: (msg: string) => emitLog("warn", msg),
  error: (msg: string) => emitLog("error", msg),
  hasErrorLogged: () => false,
  clearScreen: () => {},
  hasWarned: false,
};

function watchDependenciesPlugin() {
  return {
    name: "watch-dependencies",
    configureServer(server: any) {
      const filesToWatch = [
        path.resolve("package.json"),
        path.resolve("bun.lock"),
      ];

      server.watcher.add(filesToWatch);

      server.watcher.on("change", (filePath: string) => {
        if (filesToWatch.includes(filePath)) {
          console.log(
            `\n Dependency file changed: ${path.basename(
              filePath
            )}. Clearing caches...`
          );

          exec(
            "rm -f .eslintcache tsconfig.tsbuildinfo",
            (err, stdout, stderr) => {
              if (err) {
                console.error("Failed to clear caches:", stderr);
                return;
              }
              console.log("Caches cleared successfully.\n");
            }
          );
        }
      });
    },
  };
}

function reloadTriggerPlugin() {
  return {
    name: "reload-trigger",
    configureServer(server: any) {
      const triggerFile = path.resolve(".reload-trigger");
      server.watcher.add(triggerFile);

      server.watcher.on("change", (filePath: string) => {
        if (filePath === triggerFile || filePath.endsWith(".reload-trigger")) {
          logger.info("Reload triggered via .reload-trigger");
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

/**
 * Parse a `KEY=value` dotenv-style file into a plain object. Returns `{}` when
 * the file is absent. Used to surface the connector-injected secrets the
 * DelegateBuild host writes to `.dev.vars` (workspace integration env:
 * SUPABASE_URL/SUPABASE_ANON_KEY, OMNICART_BACKEND_URL/OMNICART_PUBLISHABLE_KEY,
 * STRIPE_PUBLISHABLE_KEY, …) into the browser bundle's compile-time `define`
 * map. `.dev.vars` is read by the Cloudflare worker runtime but NOT by Vite's
 * `loadEnv`, so without this the client-side `import.meta.env.VITE_*`
 * replacements resolve empty even though the worker has the keys.
 */
function loadDevVars(cwd: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of [".dev.vars", ".dev.vars.local"]) {
    try {
      const filePath = path.resolve(cwd, name);
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        // Strip matching surrounding quotes.
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (key) out[key] = value;
      }
    } catch {
      // Best-effort: a missing/unreadable .dev.vars must never break the build.
    }
  }
  return out;
}

// https://vite.dev/config/
export default ({ mode }: { mode: string }) => {
  // Load all environment variables (with empty prefix) so system env variables are also read
  const fileEnv = loadEnv(mode, process.cwd(), "");
  // Overlay connector-injected secrets the host wrote to .dev.vars (these are
  // NOT visible to loadEnv). .dev.vars wins so the live workspace connection
  // values reach the client bundle.
  const env = { ...fileEnv, ...loadDevVars(process.cwd()) } as Record<string, string>;
  return defineConfig({
    plugins: [react(), cloudflare(), watchDependenciesPlugin(), reloadTriggerPlugin()],
    build: {
      minify: true,
      sourcemap: "inline",
      rollupOptions: {
        output: {
          sourcemapExcludeSources: false,
        },
      },
    },
    customLogger: env.VITE_LOGGER_TYPE === 'json' ? customLogger : undefined,
    css: {
      devSourcemap: true,
    },
    server: {
      allowedHosts: true,
      watch: {
        awaitWriteFinish: {
          stabilityThreshold: 150,
          pollInterval: 50,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@shared": path.resolve(__dirname, "./shared"),
        "react": path.resolve(__dirname, "./node_modules/react"),
        "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
      exclude: ["agents"],
      // Use Vite's cached optimized deps. Forcing a re-bundle on every dev
      // start made the sandbox re-optimize under slow disk IO, which 504'd
      // requests for .vite/deps/*.js (react, react-router-dom, etc.).
      force: false,
    },
    define: {
      global: "globalThis",
      // Expose the configuration keys directly to the client browser bundle at compile time
      "process.env.OMNICART_BACKEND_URL": JSON.stringify(process.env.OMNICART_BACKEND_URL || env.OMNICART_BACKEND_URL || ""),
      "process.env.OMNICART_PUBLISHABLE_KEY": JSON.stringify(process.env.OMNICART_PUBLISHABLE_KEY || env.OMNICART_PUBLISHABLE_KEY || ""),
      "process.env.STRIPE_PUBLISHABLE_KEY": JSON.stringify(process.env.STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || ""),
      "process.env.VITE_OMNICART_BACKEND_URL": JSON.stringify(process.env.OMNICART_BACKEND_URL || env.OMNICART_BACKEND_URL || ""),
      "process.env.VITE_OMNICART_PUBLISHABLE_KEY": JSON.stringify(process.env.OMNICART_PUBLISHABLE_KEY || env.OMNICART_PUBLISHABLE_KEY || ""),
      "process.env.VITE_STRIPE_PUBLIC_KEY": JSON.stringify(process.env.STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || ""),
      "process.env.VITE_STRIPE_PUBLISHABLE_KEY": JSON.stringify(process.env.STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || ""),
      "import.meta.env.VITE_OMNICART_BACKEND_URL": JSON.stringify(process.env.OMNICART_BACKEND_URL || env.OMNICART_BACKEND_URL || ""),
      "import.meta.env.VITE_OMNICART_PUBLISHABLE_KEY": JSON.stringify(process.env.OMNICART_PUBLISHABLE_KEY || env.OMNICART_PUBLISHABLE_KEY || ""),
      "import.meta.env.VITE_STRIPE_PUBLIC_KEY": JSON.stringify(process.env.STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || ""),
      "import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY": JSON.stringify(process.env.STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || ""),
      // Supabase — the workspace's connected Supabase integration injects
      // SUPABASE_URL / SUPABASE_ANON_KEY (with NEXT_PUBLIC_* aliases). The
      // storefront client reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY,
      // so bridge the connector names → the VITE_ names the app actually reads.
      "process.env.VITE_SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || ""),
      "process.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || ""),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || ""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || ""),
    },
    cacheDir: "node_modules/.vite",
  });
};
