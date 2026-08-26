// One-off audit script (not part of the app) — computes real WCAG 2.1
// contrast ratios for every text-on-background and status-color-on-white
// pairing actually used in the design system, using the exact hex values
// from tailwind.config.ts. Run with: node scripts/contrast-audit.mjs
// This is a measured check, not an assumption "the colors look fine."

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relLuminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hex1, hex2) {
  const L1 = relLuminance(hexToRgb(hex1));
  const L2 = relLuminance(hexToRgb(hex2));
  const [lighter, darker] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (lighter + 0.05) / (darker + 0.05);
}

const CANVAS = "#F7F8FC";
const SURFACE = "#FFFFFF";

const pairs = [
  // [label, foreground, background, requirement]
  ["ink (primary text) on canvas", "#1C1F2A", CANVAS, 4.5],
  ["ink (primary text) on surface", "#1C1F2A", SURFACE, 4.5],
  ["ink-muted (secondary text) on canvas", "#5B6172", CANVAS, 4.5],
  ["ink-muted on surface", "#5B6172", SURFACE, 4.5],
  ["ink-faint (tertiary text, used for real labels not just disabled state) on canvas", "#6E727D", CANVAS, 4.5],
  ["ink-faint on surface", "#6E727D", SURFACE, 4.5],
  ["accent (brand) on surface", "#6D5AE6", SURFACE, 4.5],
  ["accent-cyan (used as small text in logs/timeline) on surface", "#0B8097", SURFACE, 4.5],
  ["state-success on surface", "#0C865C", SURFACE, 4.5],
  ["state-warning on surface", "#A16A1B", SURFACE, 4.5],
  ["state-error on surface", "#D6365F", SURFACE, 4.5],
  ["white text on accent button", "#FFFFFF", "#6D5AE6", 4.5],
  ["node-trigger (blue) on surface", "#2563EB", SURFACE, 3.0], // icon-scale use, not body text — 3:1 (UI component) bar
  ["node-agent (violet) on surface", "#6D5AE6", SURFACE, 3.0],
  ["node-tool (cyan) on surface", "#0E9CB8", SURFACE, 3.0],
  ["node-condition (amber) on surface", "#B7791F", SURFACE, 3.0],
  ["node-transform (indigo) on surface", "#4F46E5", SURFACE, 3.0],
  ["node-approval (orange) on surface", "#C2600C", SURFACE, 3.0],
  ["node-output (emerald) on surface", "#0E9F6E", SURFACE, 3.0],
];

let failures = 0;
console.log("Contrast ratio audit (WCAG 2.1) — computed, not assumed\n");
for (const [label, fg, bg, requirement] of pairs) {
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= requirement;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${ratio.toFixed(2)}:1  (needs ${requirement}:1)  ${label}`);
}
console.log(`\n${failures === 0 ? "All pairings pass their bar." : `${failures} pairing(s) FAIL.`}`);
