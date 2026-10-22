// Generates public/project-files.zip with the project source code (runs automatically before every build).
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const root = process.cwd();
const out = path.join(root, "public", "project-files.zip");
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".next.previous", ".open-next", ".git", ".wrangler", ".vercel", "out", "build", "coverage", ".claude"]);
const EXCLUDE_FILE = (rel) =>
  rel === "public/project-files.zip" ||
  rel === "docs/full_conversation_history.md" ||
  /(^|\/)\.env/.test(rel) ||
  /(^|\/)\.dev\.vars/.test(rel) ||
  /\.log$/.test(rel) ||
  /\.tsbuildinfo$/.test(rel) ||
  /\.pem$/.test(rel);

const zip = new JSZip();
let count = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walk(abs);
    } else if (entry.isFile() && !EXCLUDE_FILE(rel)) {
      zip.file(`fantasy-realms/${rel}`, fs.readFileSync(abs));
      count++;
    }
  }
}

try {
  walk(root);
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`[make-project-zip] ${count} files -> public/project-files.zip (${(buf.length / 1024).toFixed(0)} KB)`);
} catch (e) {
  console.error("[make-project-zip] failed:", e);
  process.exit(1);
}
