# Paper Fox bookings

The online booking system for [Paper Fox](https://www.paper-fox.co.uk/)
crafting weekends:

- customers book places and see what they've paid;
- the Paper Fox team run events, record payments and chase balances.

- **The brief and decisions:** [`CLAUDE.md`](CLAUDE.md). Section 15 holds
  Paper Fox's details and George's decisions.
- **Setting up accounts and running it locally:** [`docs/setup.md`](docs/setup.md).
- **The database:** [`docs/data-model.md`](docs/data-model.md).
- **Deploying and rolling back:** [`docs/deploy.md`](docs/deploy.md).

Built with Next.js, Supabase (London region), Tailwind CSS and TypeScript.

```sh
pnpm install
supabase start
cp .env.example .env.local   # then fill in from `supabase status`
pnpm dev
```
