# CLAUDE.md — my-mcp-server

Context and conventions for Claude Code sessions. See `README.md` for quick start,
commands, and Leptos prerequisites.

---

## What this project is

A full-stack Rust web application using **Leptos 0.8 + Axum 0.8** with SSR and WASM hydration.
Workspace structure supports multiple crates with shared dependencies.

---

## Repository layout

```text
my-mcp-server/
├── Cargo.toml             ← [workspace] + [workspace.dependencies] + [profile.wasm-release]
├── Cargo.lock
├── rust-toolchain.toml    ← pins nightly for workspace
├── CLAUDE.md              ← you are here
├── README.md              ← quick start + prerequisites
├── LICENSE
├── .env.example           ← env var documentation (safe to read/edit)
├── .env                   ← real values (gitignored, DO NOT READ)
├── .gitignore
├── server/                ← Leptos + Axum full-stack app
│   ├── Cargo.toml         ← [package.metadata.leptos] config
│   ├── src/
│   │   ├── main.rs        ← Axum server (ssr feature)
│   │   ├── app.rs         ← Root Leptos component + Router
│   │   └── lib.rs         ← WASM entrypoint (hydrate feature)
│   ├── style/main.scss    ← Global styles (dart-sass)
│   ├── public/            ← Static assets
│   └── end2end/           ← Playwright tests
└── .claude/
    ├── settings.local.json ← model, hooks, permissions (gitignored)
    ├── hooks/
    │   └── protect-env.js  ← PreToolUse hook — blocks .env access
    └── commands/
        └── new-project.md  ← /new-project [name]
```

---

## Dependency conventions

All versions pinned in `[workspace.dependencies]` in root `Cargo.toml`.
Never add versions directly in `server/Cargo.toml` — use `.workspace = true`.

```toml
# root Cargo.toml
[workspace.dependencies]
my-crate = { version = "1.2" }

# server/Cargo.toml
my-crate.workspace = true
```

Profiles (like `[profile.wasm-release]`) must be in root `Cargo.toml`, not members.

---

## Leptos feature gates

| Feature   | Target        | Purpose                |
|-----------|---------------|------------------------|
| `ssr`     | Native binary | Server-side rendering  |
| `hydrate` | WASM          | Browser hydration      |

**Never import server-only crates without gating behind `ssr`.**

---

## Secret handling

Two guards prevent Claude Code from touching `.env` files:

- **Declarative** — `permissions.deny` in `settings.local.json` blocks `Read`/`Write` on `.env*`
- **Imperative** — `hooks/protect-env.js` exits 2 if tool targets `.env*` paths

Exception: `.env.example` is allowed.

---

## Error handling

- `anyhow::Result` — application code
- `thiserror` — typed errors for distinct variants
- Propagate with `?` — never `.unwrap()` outside `#[cfg(test)]`

---

## Logging

Use `tracing` macros exclusively — never `println!` in `src/`.

```rust
tracing::info!(port, "server starting");
tracing::debug!(tool_id = %id, "tool called");
tracing::error!(err = %e, "handler failed");
```

---

## What Claude must NOT do

- Read, write, or source any `.env*` file
- Put version numbers in `server/Cargo.toml` — use `.workspace = true`
- Put profiles in `server/Cargo.toml` — define in root only
- Use `println!` / `eprintln!` in `src/`
- Use `.unwrap()` / `.expect()` outside `#[cfg(test)]`
- Commit `settings.local.json`
- Run `cargo build` before `cargo check`
