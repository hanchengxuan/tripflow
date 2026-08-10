# Supabase setup

The migration in `migrations/` is an initial reviewable contract, not a production deployment.

Before connecting an environment:

1. Create or link a Supabase project through a private credential channel.
2. Review the schema and RLS policies with separate owner/editor/viewer/branch-member accounts.
3. Apply migrations with the Supabase CLI.
4. Copy `.env.example` to `.env.local` and provide the public project URL and publishable/anon key.
5. Never place the service-role key in the Expo client.

Financial totals are validated in both application code and database constraints. A later migration will add deferred aggregate triggers so payer/share totals must equal an expense total inside the same transaction.
