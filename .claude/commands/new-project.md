---
description: Scaffold a new full-stack Leptos + Axum project using cargo-leptos. Accepts an optional project name argument; falls back to the current root directory name. Handles project generation, workspace integration, and dev server startup.
---

# /new-project — Create a new Leptos + Axum project

**Usage:**
```
/new-project [project-name]
```

- If `[project-name]` is supplied, use it as `PROJECT_NAME`.
- If omitted, fall back to the current workspace root directory name: `basename "$PWD"`.

The resolved name must match `^[a-z][a-z0-9-]*$` (lowercase, digits, hyphens — no spaces).
If it does not, stop and tell the user to either pass a valid name as an argument or rename
the directory before re-running.

Leptos is a full-stack, fine-grained reactive Rust web framework. This command uses
`cargo-leptos` and the `start-axum` template to scaffold a production-ready SSR project
with hydration, SCSS, and WASM support.

> **Prerequisites:** Ensure the Leptos toolchain is installed first.
> See **"Leptos frontend — prerequisites"** in `README.md`.

---

## Step 1 — Resolve and confirm the project name

```bash
# Use the supplied argument, or fall back to the current directory name
PROJECT_NAME="${1:-$(basename "$PWD")}"
echo "Project name: $PROJECT_NAME"
```

Validate `$PROJECT_NAME` matches `^[a-z][a-z0-9-]*$`. If it does not, stop with:

> "`<n>` is not a valid Rust crate identifier (lowercase, digits, hyphens only).
> Pass a valid name: `/new-project my-app`, or rename the directory and re-run."

If valid, confirm before scaffolding:
> "Scaffolding Leptos + Axum project as `$PROJECT_NAME`. Proceed?"

---

## Step 2 — Scaffold the project

```bash
cargo generate --git https://github.com/leptos-rs/start-axum --name "$PROJECT_NAME" --silent
cd "$PROJECT_NAME"
```

> **Note:** Uses `cargo generate` with `--silent` for non-interactive environments.
> If `cargo-generate` is not installed: `cargo install cargo-generate --locked`.

---

## Step 2.1 — Ensure rust-toolchain.toml exists

The scaffolding defaults to `nightly: "No"`, which skips creating `rust-toolchain.toml`.
Leptos projects typically require nightly Rust. **Always create this file if missing:**

```bash
# Check if rust-toolchain.toml exists, create if missing
if [ ! -f rust-toolchain.toml ]; then
  cat > rust-toolchain.toml << 'EOF'
[toolchain]
channel = "nightly"
EOF
  echo "Created rust-toolchain.toml with nightly channel"
fi
```

---

## Step 3 — Understand the generated structure

The `start-axum` template produces:

```
$PROJECT_NAME/
├── Cargo.toml           ← [package.metadata.leptos] config lives here
├── rust-toolchain.toml  ← (optional) pins nightly version — only if nightly=Yes during scaffolding
├── src/
│   ├── main.rs          ← Axum server entrypoint (ssr feature gate)
│   ├── app.rs           ← Root Leptos component + Router
│   └── lib.rs           ← WASM entrypoint (hydrate feature gate)
├── style/
│   └── main.scss        ← Global styles, compiled by dart-sass
├── public/              ← Static assets copied verbatim to site root
└── end2end/             ← Playwright end-to-end tests
```

Key `Cargo.toml` section:

```toml
[package.metadata.leptos]
output-name  = "$PROJECT_NAME"
site-root    = "target/site"
site-pkg-dir = "pkg"
style-file   = "style/main.scss"
assets-dir   = "public"
site-addr    = "127.0.0.1:3000"
reload-port  = 3001
bin-features = ["ssr"]
lib-features = ["hydrate"]
```

Feature gates:

```toml
[features]
hydrate = ["leptos/hydrate"]          # compiled to WASM, runs in browser
ssr     = ["leptos/ssr", "leptos_axum", ...]  # compiled to native, runs on server
```

**Never import server-only crates (DB, filesystem, secrets) without gating behind `ssr`.**

> **Stable vs Nightly:** Leptos 0.8+ supports stable Rust. During scaffolding, `cargo-generate`
> prompts `nightly: "No"` by default. If you need nightly features, re-scaffold with `nightly=Yes`
> or manually create `rust-toolchain.toml` with `channel = "nightly"`.

---

## Step 4 — Start the development server

```bash
cargo leptos watch
```

Runs in parallel: server binary (`ssr`), WASM frontend (`hydrate`), dart-sass, live-reload on `:3001`.

Open browser: **http://localhost:3000**

---

## Step 5 — Integrate with the workspace (optional)

Add the generated project as a workspace member in the **root** `Cargo.toml`:

```toml
[workspace]
resolver = "2"
members  = ["server", "$PROJECT_NAME"]
```

Move the generated directory into the workspace root if needed. `cargo-leptos` reads
`[package.metadata.leptos]` from the member's own `Cargo.toml` — no workspace-level
config changes required beyond adding the member.

For a split-crate workspace use
[`start-axum-workspace`](https://github.com/leptos-rs/start-axum-workspace) instead.

---

## Common cargo-leptos commands

| Command | Description |
|---------|-------------|
| `cargo leptos watch` | Dev server with hot-reload |
| `cargo leptos build` | Debug build (server + WASM) |
| `cargo leptos build --release` | Release build (wasm-opt applied) |
| `cargo leptos test` | Run lib and bin tests |
| `cargo leptos end-to-end` | Build + serve + run Playwright |
| `cargo leptos completions zsh` | Install shell completions |

---

## Release build and deployment

```bash
cargo leptos build --release
```

Outputs: `target/server/release/$PROJECT_NAME` and `target/site/`.

Remote env vars required:

```bash
export LEPTOS_OUTPUT_NAME="$PROJECT_NAME"
export LEPTOS_SITE_ROOT="site"
export LEPTOS_SITE_PKG_DIR="pkg"
export LEPTOS_SITE_ADDR="0.0.0.0:3000"
export LEPTOS_RELOAD_PORT="3001"
```

---

## Common failures and fixes

| Error | Fix |
|-------|-----|
| `error: no matching package named 'leptos_axum'` | `cargo update` — deps may be stale |
| `wasm-bindgen version mismatch` | Follow the exact `cargo install wasm-bindgen-cli@x.y.z` in the error |
| `sass: command not found` | `npm install -g sass` (see `README.md`) |
| `error[E0554]: use of unstable feature` | Create `rust-toolchain.toml` with `channel = "nightly"` or re-scaffold with nightly=Yes |
| `address already in use :3000` | `lsof -ti:3000 \| xargs kill` |
| WASM binary too large | Use `--release` — wasm-opt runs automatically |
| `--name` flag not recognised | `cargo install cargo-generate --locked` |
| `cargo leptos` not found | See prerequisites in `README.md` |
| Name argument invalid | Pass a valid name: `/new-project my-app`, or rename the directory |

---

## Leptos concepts

```rust
// Signal — fine-grained reactivity, no VDOM
let (count, set_count) = signal(0);

// Component
#[component]
pub fn Counter() -> impl IntoView {
    let (count, set_count) = signal(0);
    view! {
        <button on:click=move |_| set_count.update(|n| *n += 1)>
            "Count: " {count}
        </button>
    }
}

// Server function — runs on server, callable from client
#[server]
pub async fn get_data(id: u32) -> Result<String, ServerFnError> {
    Ok(format!("data for {id}"))  // DB / auth here — ssr feature only
}

// Resource + Suspense — async data fetching
let data = Resource::new(move || id(), |id| get_data(id));
view! {
    <Suspense fallback=|| view! { <p>"Loading..."</p> }>
        {move || data.get().map(|d| view! { <p>{d}</p> })}
    </Suspense>
}
```

References:
- Book: https://leptos-rs.github.io/leptos/
- API docs: https://docs.rs/leptos/latest/leptos/
- Common bugs: https://github.com/leptos-rs/leptos/blob/main/docs/COMMON_BUGS.md
- Examples: https://github.com/leptos-rs/leptos/tree/main/examples
