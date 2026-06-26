-- AMINE & ALINA Home Finance v3
-- Run this in Supabase SQL Editor. Safe to run on top of the old version.
create extension if not exists pgcrypto;

create table if not exists public.expense_app_settings (
  app_id text primary key,
  currency text not null default 'RON',
  monthly_budget numeric(12,2) not null default 0,
  economy_target numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.expense_app_settings add column if not exists economy_target numeric(12,2) not null default 0;

create table if not exists public.expense_app_users (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,
  name text not null,
  monthly_income numeric(12,2) not null default 0,
  color text,
  created_at timestamptz not null default now(),
  unique(app_id, name)
);

create table if not exists public.expense_merchants (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,
  name text not null,
  logo_data text,
  logo_url text,
  website_domain text,
  created_at timestamptz not null default now(),
  unique(app_id, name)
);
alter table public.expense_merchants add column if not exists logo_url text;
alter table public.expense_merchants add column if not exists website_domain text;

create table if not exists public.expense_transactions (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,
  user_id uuid references public.expense_app_users(id) on delete set null,
  merchant_id uuid references public.expense_merchants(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount >= 0),
  category text not null default 'Other',
  tx_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_credits (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,
  name text not null,
  credit_type text not null default 'Other credit',
  monthly_payment numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  interest_rate numeric(6,2),
  end_date date,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists expense_transactions_app_month_idx on public.expense_transactions(app_id, tx_date desc);
create index if not exists expense_transactions_user_idx on public.expense_transactions(app_id, user_id, tx_date desc);
create index if not exists expense_transactions_merchant_idx on public.expense_transactions(app_id, merchant_id);
create index if not exists expense_credits_app_idx on public.expense_credits(app_id, is_active);

alter table public.expense_app_settings enable row level security;
alter table public.expense_app_users enable row level security;
alter table public.expense_merchants enable row level security;
alter table public.expense_transactions enable row level security;
alter table public.expense_credits enable row level security;

insert into public.expense_app_settings(app_id, currency, monthly_budget, economy_target)
values ('home', 'RON', 0, 0)
on conflict (app_id) do nothing;

insert into public.expense_app_users(app_id, name, monthly_income, color)
values ('home', 'AMINE', 0, '#4f46e5'), ('home', 'ALINA', 0, '#10b981')
on conflict (app_id, name) do nothing;

insert into public.expense_merchants(app_id, name, logo_data, logo_url, website_domain)
values ('home', 'Salary', '', '', ''), ('home', 'Cash', '', '', '')
on conflict (app_id, name) do nothing;
