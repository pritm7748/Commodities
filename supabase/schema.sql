-- ============================================================
-- Commodity HQ — Supabase Database Schema
-- Run this in the Supabase SQL Editor to create all tables
-- ============================================================

-- ── Price Snapshots (cached prices) ─────────────────────────

create table if not exists price_snapshots (
  id bigint generated always as identity primary key,
  commodity_id text not null,
  price numeric not null,
  previous_close numeric,
  change numeric,
  change_percent numeric,
  day_high numeric,
  day_low numeric,
  volume bigint,
  open_interest bigint,
  source text not null default 'mock',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_price_snapshots_commodity on price_snapshots(commodity_id);
create index idx_price_snapshots_fetched on price_snapshots(fetched_at desc);

-- ── Historical Daily Prices ──────────────────────────────────

create table if not exists price_history (
  id bigint generated always as identity primary key,
  commodity_id text not null,
  date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric not null,
  volume bigint,
  open_interest bigint,
  created_at timestamptz not null default now(),
  unique(commodity_id, date)
);

create index idx_price_history_lookup on price_history(commodity_id, date desc);

-- ── Open Interest Data ───────────────────────────────────────

create table if not exists oi_snapshots (
  id bigint generated always as identity primary key,
  commodity_id text not null,
  date date not null,
  price numeric not null,
  oi bigint not null,
  oi_change bigint,
  oi_change_percent numeric,
  volume bigint,
  buildup_type text, -- 'long_buildup', 'short_buildup', 'long_unwinding', 'short_covering'
  created_at timestamptz not null default now(),
  unique(commodity_id, date)
);

create index idx_oi_snapshots_lookup on oi_snapshots(commodity_id, date desc);

-- ── Weather Data Cache ───────────────────────────────────────

create table if not exists weather_data (
  id bigint generated always as identity primary key,
  region text not null,
  country text not null,
  latitude numeric,
  longitude numeric,
  temperature numeric,
  humidity numeric,
  precipitation numeric,
  wind_speed numeric,
  conditions text,
  forecast_json jsonb,
  fetched_at timestamptz not null default now()
);

create index idx_weather_region on weather_data(region, fetched_at desc);

-- ── Macro Indicators ─────────────────────────────────────────

create table if not exists macro_indicators (
  id bigint generated always as identity primary key,
  indicator_name text not null,
  country text not null default 'US',
  value numeric not null,
  previous_value numeric,
  unit text,
  period text, -- 'monthly', 'quarterly', 'yearly'
  release_date date,
  source text,
  created_at timestamptz not null default now()
);

create index idx_macro_lookup on macro_indicators(indicator_name, country, release_date desc);

-- ── News & Sentiment ─────────────────────────────────────────

create table if not exists news_items (
  id bigint generated always as identity primary key,
  title text not null,
  summary text,
  url text,
  source text,
  published_at timestamptz,
  sentiment_score numeric, -- -1 to +1
  sentiment_label text, -- 'bullish', 'bearish', 'neutral'
  commodities text[], -- related commodity IDs
  tags text[],
  created_at timestamptz not null default now()
);

create index idx_news_published on news_items(published_at desc);
create index idx_news_commodities on news_items using gin(commodities);

-- ── COT Reports (CFTC) ──────────────────────────────────────

create table if not exists cot_reports (
  id bigint generated always as identity primary key,
  commodity_id text not null,
  report_date date not null,
  commercial_long bigint,
  commercial_short bigint,
  commercial_net bigint,
  non_commercial_long bigint,
  non_commercial_short bigint,
  non_commercial_net bigint,
  non_reportable_long bigint,
  non_reportable_short bigint,
  total_oi bigint,
  created_at timestamptz not null default now(),
  unique(commodity_id, report_date)
);

create index idx_cot_lookup on cot_reports(commodity_id, report_date desc);

-- ══════════════════════════════════════════════════════════════
-- USER TABLES (with Supabase Auth integration)
-- ══════════════════════════════════════════════════════════════

-- ── User Profiles ────────────────────────────────────────────

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  default_theme text default 'dark',
  default_commodity text default 'gold-comex',
  refresh_interval int default 30,
  factor_weights jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Watchlists ───────────────────────────────────────────────

create table if not exists watchlists (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null default 'My Watchlist',
  commodities text[] not null default '{}',
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_watchlists_user on watchlists(user_id);

-- ── User Alerts ──────────────────────────────────────────────

create table if not exists alerts (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  commodity_id text not null,
  alert_type text not null, -- 'price_above', 'price_below', 'oi_change', 'technical', etc.
  condition_value numeric,
  condition_json jsonb, -- for complex conditions
  is_active boolean default true,
  triggered_at timestamptz,
  message text,
  created_at timestamptz not null default now()
);

create index idx_alerts_user on alerts(user_id, is_active);
create index idx_alerts_commodity on alerts(commodity_id, is_active);

-- ── Saved Views ──────────────────────────────────────────────

create table if not exists saved_views (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  view_type text not null, -- 'dashboard', 'chart', 'analysis'
  config_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_saved_views_user on saved_views(user_id);

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ══════════════════════════════════════════════════════════════

alter table profiles enable row level security;
alter table watchlists enable row level security;
alter table alerts enable row level security;
alter table saved_views enable row level security;

-- Profiles: users can only access their own
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Watchlists: users can only CRUD their own
create policy "Users can view own watchlists"
  on watchlists for select using (auth.uid() = user_id);
create policy "Users can create watchlists"
  on watchlists for insert with check (auth.uid() = user_id);
create policy "Users can update own watchlists"
  on watchlists for update using (auth.uid() = user_id);
create policy "Users can delete own watchlists"
  on watchlists for delete using (auth.uid() = user_id);

-- Alerts: users can only CRUD their own
create policy "Users can view own alerts"
  on alerts for select using (auth.uid() = user_id);
create policy "Users can create alerts"
  on alerts for insert with check (auth.uid() = user_id);
create policy "Users can update own alerts"
  on alerts for update using (auth.uid() = user_id);
create policy "Users can delete own alerts"
  on alerts for delete using (auth.uid() = user_id);

-- Saved views: users can only CRUD their own
create policy "Users can view own saved views"
  on saved_views for select using (auth.uid() = user_id);
create policy "Users can create saved views"
  on saved_views for insert with check (auth.uid() = user_id);
create policy "Users can update own saved views"
  on saved_views for update using (auth.uid() = user_id);
create policy "Users can delete own saved views"
  on saved_views for delete using (auth.uid() = user_id);

-- Public data tables: readable by everyone
alter table price_snapshots enable row level security;
alter table price_history enable row level security;
alter table oi_snapshots enable row level security;
alter table weather_data enable row level security;
alter table macro_indicators enable row level security;
alter table news_items enable row level security;
alter table cot_reports enable row level security;

create policy "Public read price_snapshots"
  on price_snapshots for select using (true);
create policy "Public read price_history"
  on price_history for select using (true);
create policy "Public read oi_snapshots"
  on oi_snapshots for select using (true);
create policy "Public read weather_data"
  on weather_data for select using (true);
create policy "Public read macro_indicators"
  on macro_indicators for select using (true);
create policy "Public read news_items"
  on news_items for select using (true);
create policy "Public read cot_reports"
  on cot_reports for select using (true);
