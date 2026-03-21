-- Volt / Imperium Wallet — perfiles, logs y ajustes (Supabase Auth + Postgres)
-- Ejecutá en: SQL Editor del proyecto o `supabase db push`

create extension if not exists pgcrypto;

-- ID visible en la app (mismo rango que el backend Node anterior)
create sequence if not exists public.profile_numeric_id_seq start with 500010;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  numeric_id bigint not null unique default nextval('public.profile_numeric_id_seq'),
  email text not null,
  first_name text not null default '',
  second_name text,
  first_surname text not null default '',
  second_surname text,
  created_at timestamptz not null default now(),
  btc_address text,
  usdt_address text,
  doge_address text,
  ltc_address text,
  eth_address text,
  sol_address text,
  lightning_address text,
  encrypted_seed text,
  seed_salt text,
  totp_secret text,
  pin_hash text,
  is_admin boolean not null default false
);

alter sequence public.profile_numeric_id_seq owned by public.profiles.numeric_id;

create index profiles_email_lower on public.profiles (lower(email));

-- ——— Trigger: crear perfil al registrarse en Auth ———
create or replace function public.handle_new_user ()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
begin
  insert into public.profiles (id, email, first_name, second_name, first_surname, second_surname)
    values (new.id, new.email,
      coalesce(new.raw_user_meta_data ->> 'first_name', ''),
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'second_name', '')), ''),
      coalesce(new.raw_user_meta_data ->> 'first_surname', ''),
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'second_surname', '')), ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user ();

-- ——— PIN (bcrypt en BD) ———
create or replace function public.set_user_pin (_pin text)
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
begin
  if _pin is null or length(_pin) < 4 or length(_pin) > 6 or _pin !~ '^[0-9]+$' then
    raise exception 'PIN inválido';
  end if;
  update public.profiles
    set pin_hash = crypt(_pin, gen_salt('bf'))
    where id = auth.uid();
end;
$$;

create or replace function public.verify_user_pin (_pin text)
  returns boolean
  language sql
  security definer
  set search_path = public
  as $$
  select coalesce(
    (select pin_hash is not null and pin_hash = crypt(_pin, pin_hash)
       from public.profiles
      where id = auth.uid()),
    false);
$$;

create or replace function public.clear_user_pin ()
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
begin
  update public.profiles
    set pin_hash = null
    where id = auth.uid();
end;
$$;

grant execute on function public.set_user_pin (text) to authenticated;
grant execute on function public.verify_user_pin (text) to authenticated;
grant execute on function public.clear_user_pin () to authenticated;

-- ——— Logs ———
create table public.access_log (
  id bigint generated always as identity primary key,
  user_numeric_id bigint not null references public.profiles (numeric_id) on delete cascade,
  email text,
  first_name text,
  first_surname text,
  at timestamptz not null default now()
);

create table public.operations_log (
  id bigint generated always as identity primary key,
  user_numeric_id bigint not null references public.profiles (numeric_id) on delete cascade,
  email text,
  type text not null default 'unknown',
  detail text,
  at timestamptz not null default now()
);

create table public.swap_log (
  id bigint generated always as identity primary key,
  user_numeric_id bigint not null references public.profiles (numeric_id) on delete cascade,
  email text,
  input_mint text,
  output_mint text,
  in_amount text,
  out_amount text,
  platform_fee_bps int not null default 0,
  commission_approx text,
  tx_signature text,
  at timestamptz not null default now()
);

create table public.balance_snapshots (
  user_numeric_id bigint primary key references public.profiles (numeric_id) on delete cascade,
  email text,
  total_usd text not null default '0',
  balances jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create table public.swap_settings (
  id int primary key default 1
    check (id = 1),
  platform_fee_bps int not null default 20,
  fee_wallet text not null default '9PMkkTEdEPyrACphv1sEqjJvtC51y6qr224EBcRN6fxc',
  slippage_bps int not null default 50
);

insert into public.swap_settings (id)
  values (1)
on conflict (id) do nothing;

-- ——— RLS ———
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid () = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid () = id);

alter table public.access_log enable row level security;

create policy "access_log_insert_own"
  on public.access_log for insert
  with check (exists (
    select 1
      from public.profiles p
     where p.id = auth.uid ()
       and p.numeric_id = user_numeric_id));

create policy "access_log_select_admin"
  on public.access_log for select
  using (exists (
    select 1
      from public.profiles p
     where p.id = auth.uid ()
       and p.is_admin = true));

alter table public.operations_log enable row level security;

create policy "operations_log_insert_own"
  on public.operations_log for insert
  with check (exists (
    select 1
      from public.profiles p
     where p.id = auth.uid ()
       and p.numeric_id = user_numeric_id));

create policy "operations_log_select_admin"
  on public.operations_log for select
  using (exists (
    select 1
      from public.profiles p
     where p.id = auth.uid ()
       and p.is_admin = true));

alter table public.swap_log enable row level security;

create policy "swap_log_insert_own"
  on public.swap_log for insert
  with check (exists (
    select 1
      from public.profiles p
     where p.id = auth.uid ()
       and p.numeric_id = user_numeric_id));

create policy "swap_log_select_admin"
  on public.swap_log for select
  using (exists (
    select 1
      from public.profiles p
     where p.id = auth.uid ()
       and p.is_admin = true));

alter table public.balance_snapshots enable row level security;

create policy "balance_snapshots_upsert_own"
  on public.balance_snapshots for insert
  with check (exists (
    select 1
      from public.profiles p
     where p.id = auth.uid ()
       and p.numeric_id = user_numeric_id));

create policy "balance_snapshots_update_own"
  on public.balance_snapshots for update
  using (exists (
    select 1
      from public.profiles p
     where p.id = auth.uid ()
       and p.numeric_id = user_numeric_id));

create policy "balance_snapshots_select_admin"
  on public.balance_snapshots for select
  using (exists (
    select 1
      from public.profiles p
     where p.id = auth.uid ()
       and p.is_admin = true));

alter table public.swap_settings enable row level security;

create policy "swap_settings_read_auth"
  on public.swap_settings for select
  to authenticated
  using (true);

create policy "swap_settings_update_admin"
  on public.swap_settings for update
  using (exists (
    select 1
      from public.profiles p
     where p.id = auth.uid ()
       and p.is_admin = true));

-- Permitir INSERT inicial de fila swap_settings (solo service role en la práctica)
create policy "swap_settings_insert_service"
  on public.swap_settings for insert
  to service_role
  with check (true);
