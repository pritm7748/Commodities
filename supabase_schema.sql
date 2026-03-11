-- ============================================================
-- Supabase Schema for Commodity Tool
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. User Watchlists
create table if not exists user_watchlists (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    icon text default '⭐',
    items jsonb default '[]'::jsonb,
    created_at timestamptz default now()
);

alter table user_watchlists enable row level security;

create policy "Users can view own watchlists"
    on user_watchlists for select using (auth.uid() = user_id);
create policy "Users can insert own watchlists"
    on user_watchlists for insert with check (auth.uid() = user_id);
create policy "Users can update own watchlists"
    on user_watchlists for update using (auth.uid() = user_id);
create policy "Users can delete own watchlists"
    on user_watchlists for delete using (auth.uid() = user_id);

-- 2. User Trades
create table if not exists user_trades (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    commodity text not null,
    ticker text not null,
    icon text,
    direction text not null check (direction in ('long', 'short')),
    entry_price numeric not null,
    quantity numeric default 1,
    entry_date text,
    exit_price numeric,
    exit_date text,
    status text default 'open' check (status in ('open', 'closed')),
    created_at timestamptz default now()
);

alter table user_trades enable row level security;

create policy "Users can view own trades"
    on user_trades for select using (auth.uid() = user_id);
create policy "Users can insert own trades"
    on user_trades for insert with check (auth.uid() = user_id);
create policy "Users can update own trades"
    on user_trades for update using (auth.uid() = user_id);
create policy "Users can delete own trades"
    on user_trades for delete using (auth.uid() = user_id);

-- 3. User Alerts
create table if not exists user_alerts (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    commodity text not null,
    ticker text not null,
    icon text,
    type text not null check (type in ('price_above', 'price_below', 'pct_up', 'pct_down')),
    value numeric not null,
    note text default '',
    status text default 'armed' check (status in ('armed', 'triggered', 'silenced')),
    triggered_at timestamptz,
    triggered_price numeric,
    created_at timestamptz default now()
);

alter table user_alerts enable row level security;

create policy "Users can view own alerts"
    on user_alerts for select using (auth.uid() = user_id);
create policy "Users can insert own alerts"
    on user_alerts for insert with check (auth.uid() = user_id);
create policy "Users can update own alerts"
    on user_alerts for update using (auth.uid() = user_id);
create policy "Users can delete own alerts"
    on user_alerts for delete using (auth.uid() = user_id);

-- 4. User Reports (saved report history)
create table if not exists user_reports (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    type text,
    title text,
    generated_at timestamptz default now(),
    commodity_count integer default 0,
    created_at timestamptz default now()
);

alter table user_reports enable row level security;

create policy "Users can view own reports"
    on user_reports for select using (auth.uid() = user_id);
create policy "Users can insert own reports"
    on user_reports for insert with check (auth.uid() = user_id);
create policy "Users can update own reports"
    on user_reports for update using (auth.uid() = user_id);
create policy "Users can delete own reports"
    on user_reports for delete using (auth.uid() = user_id);
