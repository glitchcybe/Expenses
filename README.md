# AMINE & ALINA Home Finance v3

This version is rebuilt around your real needs:

- No passcode screen.
- Users: AMINE / ALINA, plus you can add more users.
- Income can be added by choosing the user.
- Expenses are organized in the left menu by category: Shopping, Going outside, Groceries, Fuel, House, Car, Kids, Health, Travel, Other.
- Main dashboard shows money remaining after expenses and credits.
- Economies / savings target.
- Credit section for house credit, car credit, personal credit and other credits.
- Merchant logo auto lookup by name/domain. Saved logo URL is reused in future transactions.

## Security note

You asked to remove the passcode. This means anyone who has the Netlify URL can open and edit the app.
Your Supabase service key is still server-side only inside Netlify environment variables.

## Netlify variables

Keep these variables:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-api-key
APP_ID=home
```

`APP_PASSCODE` is no longer used.

## Supabase update

Run this in Supabase SQL Editor:

```text
supabase/schema.sql
```

It is safe to run over the old schema. It adds:

- economy_target
- merchant logo_url and website_domain
- expense_credits table

## Push update

From this folder:

```bash
git add .
git commit -m "Upgrade home finance app v3"
git push
```

If GitHub still has the wrong structure:

```bash
git push -u origin main --force
```

Then in Netlify:

```text
Deploys → Trigger deploy → Clear cache and deploy site
```
