# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

**Planned future migration:** the confirmed end-goal is to move the backend off Base44 onto Supabase (Postgres/auth/storage) with Vercel hosting. That has not started and should not be pre-abstracted for — keep using normal Base44 conventions (entities, `base44/functions`, `base44.entities.*`/`base44.functions.invoke`) for all feature work until the migration is explicitly scheduled as its own phase. See `docs/DEFERRED.md` for the full scope of what that migration will touch.

**What "brokers" actually are:** despite the internal `Broker` entity/naming (a holdover from earlier naming), Relay's brokers are **car-leasing/dealer-inventory brokers** — middlemen who arrange for dealership (or individual-owned) vehicles to be transported, e.g. lease returns and dealer-to-dealer inventory moves. They are **not** FMCSA-regulated freight brokers and generally don't hold FMCSA broker authority — some have a broker license and insurance, some only have a W-9 on file. Don't assume freight/property-broker regulatory framing (FMCSA authority, MC-number-as-federal-credential, etc.) applies here; it doesn't. The user has explicitly decided, for the initial launch, that Relay-the-platform does not carry or provide insurance for vehicles in transit — that's left entirely to the broker/vehicle owner, on the reasoning that the existing dealership/owner insurance policy typically covers permissive third-party use (same pattern as test drives/loaners). That's a deliberate, already-made product decision — don't relitigate it in future work; if it comes up again, the one still-open question worth surfacing (once, not repeatedly) is whether that existing coverage extends the same way to an unrelated gig-marketplace driver for a full multi-hour/overnight pickup-to-delivery window, versus a same-day test drive.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.
