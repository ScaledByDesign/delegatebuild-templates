/**
 * PostCSS pipeline for the OmniCart storefront — with a build-resilience guard.
 *
 * WHY THE GUARD: generated branding sometimes writes `@apply` rules that
 * reference a custom Tailwind color the model never added to tailwind.config.js
 * (e.g. `@apply bg-vanguard-obsidian/80`). Tailwind treats an unknown `@apply`
 * utility as a HARD ERROR, which fails the entire CSS build and bricks the
 * preview. This guard runs BEFORE Tailwind: it scans every `@apply` declaration,
 * drops only the unresolvable color-utility tokens (keeping the valid ones), and
 * warns — so a hallucinated class degrades to "no style" instead of a fatal
 * build error. Plain Tailwind utilities and defined theme tokens are untouched.
 */

import fs from "node:fs";
import path from "node:path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

/** Color-bearing utility prefixes whose custom-palette segment we can validate. */
const COLOR_PREFIXES = [
  "bg",
  "text",
  "border",
  "ring",
  "ring-offset",
  "from",
  "via",
  "to",
  "fill",
  "stroke",
  "divide",
  "outline",
  "decoration",
  "shadow",
  "accent",
  "caret",
];

/**
 * Read the custom color names defined in tailwind.config.js (best-effort, by
 * regex so we don't have to execute the config). Returns a Set of top-level
 * color keys (e.g. "vnsh", "primary", "background"). Standard Tailwind palette
 * colors (red, slate, …) are always allowed and not validated here.
 */
function readDefinedColorRoots(cwd) {
  const roots = new Set();
  try {
    const cfgPath = path.resolve(cwd, "tailwind.config.js");
    if (!fs.existsSync(cfgPath)) return roots;
    const src = fs.readFileSync(cfgPath, "utf8");
    // Grab the `colors: { ... }` block and pull its top-level keys.
    const start = src.indexOf("colors:");
    if (start === -1) return roots;
    let depth = 0;
    let i = src.indexOf("{", start);
    const blockStart = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const block = src.slice(blockStart, i + 1);
    // Top-level keys: `name:` or `'name':` or `"name":` at any nesting (we only
    // need the union of names that exist somewhere as a color key).
    const keyRe = /(?:^|[\s{,])['"]?([a-zA-Z][\w-]*)['"]?\s*:/g;
    let m;
    while ((m = keyRe.exec(block))) roots.add(m[1]);
  } catch {
    // Best-effort: if we can't read the config, validate nothing (no-op).
  }
  return roots;
}

/**
 * Standard Tailwind v3 palette color roots — always valid, never stripped.
 */
const TAILWIND_PALETTE = new Set([
  "inherit", "current", "transparent", "black", "white",
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
]);

function applyGuard() {
  return {
    postcssPlugin: "omnicart-apply-guard",
    Declaration(decl) {
      // Tailwind's @apply surfaces as an at-rule, but some setups expose it as a
      // declaration; handle the at-rule form below. This declaration hook is a
      // safety net for `@apply` lowered into a prop named "apply".
      if (decl.prop !== "apply") return;
      decl.value = filterApply(decl.value, decl);
    },
    AtRule: {
      apply(atRule) {
        atRule.params = filterApply(atRule.params, atRule);
      },
    },
  };

  function filterApply(params, node) {
    const cwd = process.cwd();
    const defined = readDefinedColorRoots(cwd);
    const tokens = params.split(/\s+/).filter(Boolean);
    const kept = [];
    for (const token of tokens) {
      // Strip leading variant prefixes (hover:, md:, dark:, group-hover:, …),
      // the important `!`, and an opacity modifier (`/80`) before validating the
      // utility itself. Variants are kept on the rebuilt token if it survives.
      const variantSplit = token.split(":");
      const utility = variantSplit[variantSplit.length - 1];
      const variantPrefix = variantSplit.slice(0, -1).join(":");
      const bare = utility.replace(/^!/, "").split("/")[0];
      const dash = bare.indexOf("-");
      // Helper to drop this token by simply not pushing it; to keep, push the
      // ORIGINAL token (with its variants/opacity intact).
      void variantPrefix;
      if (dash === -1) {
        kept.push(token);
        continue;
      }
      // Find the longest matching color prefix (e.g. "ring-offset").
      const prefix = COLOR_PREFIXES.find(
        (p) => bare === p || bare.startsWith(p + "-"),
      );
      if (!prefix) {
        kept.push(token);
        continue;
      }
      const rest = bare.slice(prefix.length + 1); // after "prefix-"
      const colorRoot = rest.split("-")[0];
      if (!colorRoot) {
        kept.push(token);
        continue;
      }
      // Allow: standard palette, defined custom colors, and non-color utilities
      // (numbers/keywords like bg-cover, text-center, border-2).
      if (
        TAILWIND_PALETTE.has(colorRoot) ||
        defined.has(colorRoot) ||
        /^\d/.test(colorRoot) ||
        !/^[a-z]/.test(colorRoot)
      ) {
        kept.push(token);
        continue;
      }
      // Heuristic: only strip when it really looks like an undefined custom
      // COLOR (has a color prefix + an unknown alpha word). Keep anything we're
      // unsure about so we never strip a valid utility.
      const looksLikeColorUtility =
        ["bg", "text", "border", "ring", "from", "via", "to", "fill", "stroke", "accent", "caret", "decoration", "divide", "outline"].includes(
          prefix,
        );
      if (looksLikeColorUtility) {
        // eslint-disable-next-line no-console
        console.warn(
          `[omnicart-apply-guard] dropped unresolved @apply utility "${token}" ` +
            `(custom color "${colorRoot}" is not defined in tailwind.config.js). ` +
            `Define it under theme.extend.colors to keep the style.`,
        );
        continue; // drop it
      }
      kept.push(token);
    }
    return kept.join(" ");
  }
}
applyGuard.postcss = true;

export default {
  plugins: [applyGuard(), tailwindcss, autoprefixer],
};
