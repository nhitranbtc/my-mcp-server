# my-mcp-server

A production-ready [MCP](https://modelcontextprotocol.io) backend server built with Axum + Tokio.

## Quick start

```bash
cp .env.example .env   # fill in real values — gitignored
cargo run -p my-mcp-server
```

## MCP endpoints

| Method | Path              | Description           |
|--------|-------------------|-----------------------|
| GET    | `/mcp/tools`      | List available tools  |
| POST   | `/mcp/tools/:id`  | Call a tool           |
| GET    | `/mcp/resources`  | List resources        |
| GET    | `/mcp/prompts`    | List prompt templates |
| GET    | `/health`         | Health check          |

---

## /run — Start the server

```bash
cargo run -p my-mcp-server                                      # dev, port 3000
PORT=8080 cargo run -p my-mcp-server                           # custom port
RUST_LOG=debug cargo run -p my-mcp-server                      # verbose logging
RUST_LOG=my_mcp_server=debug,tower_http=debug cargo run -p my-mcp-server
cargo watch -x "run -p my-mcp-server"                          # hot-reload (cargo-watch)
./target/release/my-mcp-server                                 # run release binary directly
```

Verify the server is up:

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/mcp/tools | jq .
curl -s -X POST http://localhost:3000/mcp/tools/echo \
  -H 'Content-Type: application/json' \
  -d '{"arguments":{"message":"hello MCP"}}' | jq .
```

Run with Docker:

```dockerfile
FROM rust:1.82-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release -p my-mcp-server

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/my-mcp-server /usr/local/bin/
EXPOSE 3000
CMD ["my-mcp-server"]
```

```bash
docker build -t my-mcp-server .
docker run --env-file .env -p 3000:3000 my-mcp-server
```

Graceful shutdown: the server handles `SIGTERM` / `Ctrl-C` — in-flight requests finish before exit.

---

## /build — Build the server

```bash
cargo check --workspace                                         # pre-flight (always run first)
cargo build -p my-mcp-server                                   # debug build → target/debug/
cargo build --release -p my-mcp-server                        # release build → target/release/
strip target/release/my-mcp-server                            # strip for smaller deploy artifact
RUSTFLAGS="-D warnings" cargo build --release -p my-mcp-server # CI strict (warnings = errors)
```

Post-build smoke test:

```bash
./target/release/my-mcp-server &
sleep 1
curl -sf http://localhost:3000/health && echo "✅ healthy" || echo "❌ failed"
kill %1
```

Common build failures:

| Error | Fix |
|-------|-----|
| `no bin target named 'my-mcp-server'` | Check `[[bin]] name` in `server/Cargo.toml` |
| `failed to resolve: use of undeclared crate` | Add dep to `server/Cargo.toml` + `[workspace.dependencies]` |
| `error: linking with 'cc' failed` | `apt install build-essential` |
| `could not find 'Cargo.toml'` | Run from workspace root, not `server/` |

---

## /test — Test the server

```bash
cargo test --workspace -- --nocapture                          # full suite
cargo test --workspace -- tools:: --nocapture                 # filter by module
cargo test --lib -p my-mcp-server -- --nocapture              # unit tests only
cargo test --test '*' -p my-mcp-server -- --nocapture         # integration tests only
cargo watch -x "test --workspace -- --nocapture"              # watch mode
cargo llvm-cov --workspace                                     # coverage summary
```

Unit test pattern:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tool_list_returns_echo() {
        let Json(tools) = list().await;
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].name, "echo");
    }
}
```

Integration tests live in `server/tests/`. Add `axum-test = "0.5"` to `[dev-dependencies]`
in `server/Cargo.toml` to use `TestServer`.

---

## /new-project — Scaffold a Leptos + Axum frontend

```bash
/new-project [project-name]
```

Uses `[project-name]` if supplied, otherwise falls back to `basename "$PWD"`.
See **Leptos frontend — prerequisites** below before running.

---

For project conventions, architecture, and coding rules see **[CLAUDE.md](./CLAUDE.md)**.

---

## Leptos frontend — prerequisites

Install once per machine before running `/new-project`.

### 1. Rust nightly

```bash
rustup toolchain install nightly --allow-downgrade
rustup default nightly
```

### 2. WASM target

```bash
rustup target add wasm32-unknown-unknown
```

### 3. cargo-generate + cargo-leptos

```bash
cargo install cargo-generate --locked
cargo install cargo-leptos --locked
```

> `openssl-sys` build failure on Linux: `sudo apt install pkg-config libssl-dev` (Debian/Ubuntu)
> or `sudo dnf install openssl-devel` (Fedora/RHEL), then retry.

### 4. dart-sass

```bash
npm install -g sass
```

Once done: `/new-project [project-name]` in Claude Code.
