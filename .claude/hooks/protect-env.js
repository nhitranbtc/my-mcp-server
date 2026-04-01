#!/usr/bin/env node
// =============================================================================
// .claude/hooks/protect-env.sh  (Node.js — follows tsc.js hook pattern)
//
// PreToolUse hook — blocks any Claude Code tool from reading or writing .env
// files. Registered in .claude/settings.local.json under hooks.PreToolUse.
//
// Protocol (mirrors tsc.js):
//   stdin  → JSON with tool_name, tool_input, tool_response
//   exit 0 → allow the tool to proceed
//   exit 2 → block the tool (Claude Code surfaces stderr as the error)
// =============================================================================

// ── Read stdin (identical to tsc.js readInput) ───────────────────────────────
async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

// ── .env detection ────────────────────────────────────────────────────────────
// Matches: .env  .env.local  .env.production  .env.staging  etc.
// Exception: .env.example is always allowed.
const ENV_PATTERN = /\.env(\.|$)/;
const EXAMPLE_PATTERN = /\.env\.example/;

function isEnvPath(str) {
  if (!str || typeof str !== "string") return false;
  if (EXAMPLE_PATTERN.test(str)) return false; // safe — always allow
  return ENV_PATTERN.test(str);
}

// Recursively walk any value and collect all strings
function collectStrings(value, results = []) {
  if (typeof value === "string") {
    results.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, results);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, results);
  }
  return results;
}

// ── Block helpers ─────────────────────────────────────────────────────────────
function block(toolName, reason) {
  console.error(`🔒 protect-env [${toolName}]: BLOCKED — ${reason}`);
  console.error("   .env files are off-limits to Claude Code.");
  console.error("   Document vars in .env.example; load secrets at runtime only.");
  process.exit(2);
}

// ── Bash command patterns that touch .env ────────────────────────────────────
const BASH_READ_RE  = /(cat|less|more|head|tail|bat|vim|nano|code)\s+[^\s]*\.env(\s|$|\.)/;
const BASH_WRITE_RE = /(cp|mv|tee|echo|printf|install)\s.*\.env(\s|$|\.)/;
const BASH_SRC_RE   = /(source|\.)\s+[^\s]*\.env(\s|$|\.)/;
const BASH_SRCH_RE  = /(grep|rg|ag|awk|sed|cut)\s.*\.env(\s|$|\.)/;
const BASH_DOCK_RE  = /--env-file\s+[^\s]*\.env(\s|$|\.)/;
const BASH_GIT_RE   = /git\s+(add|diff|show|log|cat-file).*\.env(\s|$|\.)/;

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const input = await readInput();

  // Mirrors tsc.js: pull from tool_response or tool_input
  const toolName  = input.tool_name  || "unknown";
  const toolInput = input.tool_input || {};

  // ── 1. Explicit path field (Read, Write, Edit, MultiEdit) ─────────────────
  const filePath =
    input.tool_response?.filePath ||
    toolInput.file_path            ||
    toolInput.path                 ||
    "";

  if (isEnvPath(filePath)) {
    block(toolName, `path argument targets '${filePath}'`);
  }

  // ── 2. Glob / pattern fields (LS, search tools) ───────────────────────────
  const globPattern = toolInput.pattern || toolInput.glob || "";
  if (isEnvPath(globPattern)) {
    block(toolName, `glob pattern '${globPattern}' matches .env files`);
  }

  // ── 3. Bash / shell commands ──────────────────────────────────────────────
  if (toolName === "Bash" || toolName === "bash_tool") {
    const cmd = toolInput.command || toolInput.cmd || "";
    if (BASH_READ_RE.test(cmd))  block(toolName, `bash reads a .env file: ${cmd.slice(0, 80)}`);
    if (BASH_WRITE_RE.test(cmd)) block(toolName, `bash writes to a .env file: ${cmd.slice(0, 80)}`);
    if (BASH_SRC_RE.test(cmd))   block(toolName, `bash sources a .env file: ${cmd.slice(0, 80)}`);
    if (BASH_SRCH_RE.test(cmd))  block(toolName, `bash searches inside a .env file: ${cmd.slice(0, 80)}`);
    if (BASH_DOCK_RE.test(cmd))  block(toolName, `bash passes .env via --env-file: ${cmd.slice(0, 80)}`);
    if (BASH_GIT_RE.test(cmd))   block(toolName, `bash exposes .env via git: ${cmd.slice(0, 80)}`);
  }

  // ── 4. Grep tool ──────────────────────────────────────────────────────────
  if (toolName === "Grep" || toolName === "grep_tool") {
    const include    = toolInput.include || "";
    const searchPath = toolInput.path    || "";
    if (isEnvPath(include) || isEnvPath(searchPath)) {
      block(toolName, "grep targets .env files");
    }
  }

  // ── 5. Wildcard — scan every string value in tool_input ──────────────────
  // Last-resort catch: walk all string values recursively (same idea as
  // tsc.js collecting all diagnostics before returning).
  const allStrings = collectStrings(toolInput);
  for (const s of allStrings) {
    if (isEnvPath(s)) {
      block(toolName, `tool argument references a .env file: '${s.slice(0, 60)}'`);
    }
  }

  // ── All checks passed — allow the tool ───────────────────────────────────
  process.exit(0);
}

main();
