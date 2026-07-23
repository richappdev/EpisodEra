# CLI link status

| Step | Status |
| --- | --- |
| `supabase init` | Done — `supabase/` in repo |
| `[auth.third_party.firebase]` | Enabled for `episodera` in `config.toml` |
| Local `supabase/.temp/project-ref` | Set to `xyhhnoxvydshqpypwccr` (gitignored) |
| `supabase login` / `supabase link` | **Blocked in CI/agent** — requires `SUPABASE_ACCESS_TOKEN` or interactive login |

## Complete on your machine

```bash
npx supabase login
npx supabase link --project-ref xyhhnoxvydshqpypwccr
npx supabase db push   # review migrations first; manual approval
```

Dashboard: also add Firebase third-party Auth for project `episodera` to match `config.toml`.
