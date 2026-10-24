create extension if not exists pgcrypto;

create type public.profile_role as enum ('owner', 'staff');
create type public.model_status as enum ('available', 'upcoming', 'discontinued');
create type public.unit_grade as enum ('A', 'B', 'C');
create type public.unit_status as enum ('available', 'reserved', 'sold', 'hidden');
create type public.lead_type as enum ('trade_in', 'notify_me', 'contact', 'reservation');
create type public.lead_status as enum ('new', 'contacted', 'closed');
create type public.sale_kind as enum ('new', 'used');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.profile_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  logo_path text,
  created_at timestamptz not null default now()
);

create table public.phone_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id),
  name text not null,
  slug text not null unique,
  status public.model_status not null default 'available',
  expected_date text,
  expected_price_range text,
  tagline text not null default '',
  hero_image_path text,
  specs jsonb not null default '{}'::jsonb,
  spec_meta jsonb not null default '{}'::jsonb,
  specs_reviewed boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, name),
  check (status <> 'upcoming' or expected_date is not null)
);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.phone_models(id) on delete cascade,
  ram_gb integer not null check (ram_gb between 1 and 24),
  storage_gb integer not null check (storage_gb between 1 and 2048),
  color_name text not null,
  color_hex text not null default '#777777' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  price numeric(12,2) not null check (price > 0),
  old_price numeric(12,2) check (old_price is null or old_price > price),
  stock_count integer not null default 0 check (stock_count >= 0),
  low_stock_threshold integer not null default 2 check (low_stock_threshold >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (model_id, ram_gb, storage_gb, color_name)
);

create table public.used_units (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.phone_models(id),
  ram_gb integer not null check (ram_gb between 1 and 24),
  storage_gb integer not null check (storage_gb between 1 and 2048),
  color_name text not null,
  grade public.unit_grade not null,
  battery_health_pct integer check (battery_health_pct between 1 and 100),
  accessories text not null default 'Phone only',
  warranty_months integer not null default 0 check (warranty_months >= 0),
  price numeric(12,2) not null check (price > 0),
  cost_price numeric(12,2) check (cost_price is null or cost_price >= 0),
  imei text,
  notes_internal text not null default '',
  status public.unit_status not null default 'available',
  is_published boolean not null default false,
  reserved_until timestamptz,
  sold_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (imei is null or imei ~ '^[0-9]{14,16}$')
);

create table public.used_unit_photos (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.used_units(id) on delete cascade,
  path text not null,
  sort_order integer not null default 0,
  is_main boolean not null default false,
  alt_text text not null default ''
);

create table public.model_photos (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.phone_models(id) on delete cascade,
  path text not null,
  sort_order integer not null default 0,
  is_main boolean not null default false,
  alt_text text not null default ''
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  kind public.sale_kind not null,
  variant_id uuid references public.variants(id),
  unit_id uuid references public.used_units(id),
  quantity integer not null check (quantity > 0),
  sale_price numeric(12,2) not null check (sale_price > 0),
  sold_at timestamptz not null default now(),
  sold_by uuid references public.profiles(id),
  buyer_note text,
  undone_at timestamptz,
  check ((kind = 'new' and variant_id is not null and unit_id is null) or (kind = 'used' and unit_id is not null and variant_id is null))
);

create table public.trade_in_values (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references public.phone_models(id) on delete set null,
  brand_text text not null,
  model_text text not null,
  storage_gb integer not null check (storage_gb > 0),
  base_value numeric(12,2) not null check (base_value > 0),
  is_active boolean not null default true,
  unique (brand_text, model_text, storage_gb)
);

create table public.trade_in_config (
  id integer primary key check (id = 1),
  config jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  type public.lead_type not null,
  name text not null check (length(name) between 1 and 120),
  contact text not null check (length(contact) between 3 and 240),
  payload jsonb not null default '{}'::jsonb check (pg_column_size(payload) < 16384),
  status public.lead_status not null default 'new',
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create table public.shop_settings (
  id integer primary key check (id = 1),
  name text not null default 'Siaab Mobile',
  currency text not null default 'ETB',
  phone text not null default '+251923641747',
  whatsapp text not null default '+251923641747',
  telegram text not null default 'https://t.me/Siaabmobiles',
  email text not null default 'hello@siaabmobile.com',
  address text not null default 'Megenagna Marathon Building 1st floor No. 34',
  hours text not null default 'Monday–Saturday, 9:00 AM–7:00 PM',
  sold_badge_days integer not null default 5 check (sold_badge_days between 0 and 30),
  low_stock_default integer not null default 2 check (low_stock_default between 0 and 100),
  updated_at timestamptz not null default now()
);

create index phone_models_status_idx on public.phone_models(status);
create index variants_published_idx on public.variants(is_published, model_id);
create index used_units_published_idx on public.used_units(is_published, status);
create index sales_sold_at_idx on public.sales(sold_at);
create index leads_created_at_idx on public.leads(created_at desc);
create index leads_contact_created_idx on public.leads(contact, created_at desc);
create index audit_log_created_idx on public.audit_log(created_at desc);

create function public.is_staff_or_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()));
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'owner');
$$;

create function public.protect_used_unit_private_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_owner() then
    if tg_op = 'INSERT' then
      if new.cost_price is not null or new.imei is not null or new.notes_internal <> '' then
        raise exception 'Only an owner can set private used-phone fields';
      end if;
    elsif new.cost_price is distinct from old.cost_price
       or new.imei is distinct from old.imei
       or new.notes_internal is distinct from old.notes_internal then
      raise exception 'Only an owner can change private used-phone fields';
    end if;
  end if;
  return new;
end;
$$;

create trigger used_units_private_fields
before insert or update on public.used_units
for each row execute function public.protect_used_unit_private_fields();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger phone_models_touch before update on public.phone_models for each row execute function public.touch_updated_at();
create trigger shop_settings_touch before update on public.shop_settings for each row execute function public.touch_updated_at();
create trigger trade_in_config_touch before update on public.trade_in_config for each row execute function public.touch_updated_at();

create function public.enforce_reviewed_specs() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'available' and not new.specs_reviewed then
    raise exception 'Confirm model specifications before marking it available';
  end if;
  return new;
end;
$$;
create trigger phone_models_review_gate before insert or update of status, specs_reviewed on public.phone_models for each row execute function public.enforce_reviewed_specs();

create function public.log_inventory_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  before_data jsonb;
  after_data jsonb;
  row_id text;
begin
  if tg_op <> 'INSERT' then before_data = to_jsonb(old); row_id = before_data ->> 'id'; end if;
  if tg_op <> 'DELETE' then after_data = to_jsonb(new); row_id = after_data ->> 'id'; end if;
  insert into public.audit_log(user_id, action, table_name, record_id, before, after)
  values ((select auth.uid()), tg_op, tg_table_name, row_id, before_data, after_data);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_phone_models after insert or update or delete on public.phone_models for each row execute function public.log_inventory_change();
create trigger audit_variants after insert or update or delete on public.variants for each row execute function public.log_inventory_change();
create trigger audit_used_units after insert or update or delete on public.used_units for each row execute function public.log_inventory_change();
create trigger audit_trade_values after insert or update or delete on public.trade_in_values for each row execute function public.log_inventory_change();
create trigger audit_settings after insert or update or delete on public.shop_settings for each row execute function public.log_inventory_change();
create trigger audit_trade_config after insert or update or delete on public.trade_in_config for each row execute function public.log_inventory_change();

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.phone_models enable row level security;
alter table public.variants enable row level security;
alter table public.used_units enable row level security;
alter table public.used_unit_photos enable row level security;
alter table public.model_photos enable row level security;
alter table public.sales enable row level security;
alter table public.trade_in_values enable row level security;
alter table public.trade_in_config enable row level security;
alter table public.leads enable row level security;
alter table public.audit_log enable row level security;
alter table public.shop_settings enable row level security;

create policy profile_self_read on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_owner());
create policy profile_owner_manage on public.profiles for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy brands_staff_read on public.brands for select to authenticated using (public.is_staff_or_owner());
create policy brands_staff_insert on public.brands for insert to authenticated with check (public.is_staff_or_owner());
create policy brands_owner_manage on public.brands for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy brands_owner_delete on public.brands for delete to authenticated using (public.is_owner());

create policy models_staff_read on public.phone_models for select to authenticated using (public.is_staff_or_owner());
create policy models_staff_insert on public.phone_models for insert to authenticated with check (public.is_staff_or_owner());
create policy models_staff_update on public.phone_models for update to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy models_owner_delete on public.phone_models for delete to authenticated using (public.is_owner());
create policy variants_staff_read on public.variants for select to authenticated using (public.is_staff_or_owner());
create policy variants_staff_insert on public.variants for insert to authenticated with check (public.is_staff_or_owner());
create policy variants_staff_update on public.variants for update to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy variants_owner_delete on public.variants for delete to authenticated using (public.is_owner());
create policy used_staff_read on public.used_units for select to authenticated using (public.is_staff_or_owner());
create policy used_staff_insert on public.used_units for insert to authenticated with check (public.is_staff_or_owner());
create policy used_staff_update on public.used_units for update to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy used_owner_delete on public.used_units for delete to authenticated using (public.is_owner());
create policy model_photos_staff_manage on public.model_photos for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy unit_photos_staff_manage on public.used_unit_photos for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy sales_staff_read on public.sales for select to authenticated using (public.is_staff_or_owner());
create policy trade_values_staff_read on public.trade_in_values for select to authenticated using (public.is_staff_or_owner());
create policy trade_values_owner_manage on public.trade_in_values for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy trade_config_staff_read on public.trade_in_config for select to authenticated using (public.is_staff_or_owner());
create policy trade_config_owner_manage on public.trade_in_config for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy leads_staff_manage on public.leads for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy audit_owner_read on public.audit_log for select to authenticated using (public.is_owner());
create policy settings_staff_read on public.shop_settings for select to authenticated using (public.is_staff_or_owner());
create policy settings_owner_manage on public.shop_settings for all to authenticated using (public.is_owner()) with check (public.is_owner());

grant usage on schema public to anon, authenticated;
grant usage on type public.profile_role, public.model_status, public.unit_grade, public.unit_status,
  public.lead_type, public.lead_status, public.sale_kind to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.brands, public.phone_models, public.variants,
  public.model_photos, public.used_unit_photos, public.sales, public.trade_in_values, public.trade_in_config,
  public.leads, public.audit_log, public.shop_settings to authenticated;
grant insert, update, delete on public.used_units to authenticated;

create view public.public_models with (security_barrier = true) as
select m.id, b.name as brand, b.slug as brand_slug, m.name, m.slug, m.status, m.expected_date, m.expected_price_range, m.tagline,
       m.hero_image_path, m.specs, m.specs_reviewed, m.created_at, m.updated_at
from public.phone_models m join public.brands b on b.id = m.brand_id
where m.status in ('available', 'upcoming') and m.specs_reviewed = true;

create view public.public_variants with (security_barrier = true) as
select v.id, v.model_id, v.ram_gb, v.storage_gb, v.color_name, v.color_hex, v.price, v.old_price,
       greatest(v.stock_count, 0) as stock_count, v.low_stock_threshold,
       case when v.stock_count = 0 then 'out_of_stock'
            when v.stock_count <= v.low_stock_threshold then 'low_stock'
            else 'in_stock' end as stock_status
from public.variants v
join public.phone_models m on m.id = v.model_id
where v.is_published = true and m.status = 'available' and m.specs_reviewed = true;

create view public.public_used_units with (security_barrier = true) as
select u.id, u.model_id, u.ram_gb, u.storage_gb, u.color_name, u.grade,
       u.battery_health_pct, u.accessories, u.warranty_months, u.price,
       case when u.status = 'sold' then 'sold'
            when u.status = 'reserved' and u.reserved_until > now() then 'reserved'
            else 'available' end as display_status,
       u.sold_at,
       coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'alt_text', p.alt_text, 'sort_order', p.sort_order) order by p.sort_order)
                 from public.used_unit_photos p where p.unit_id = u.id), '[]'::jsonb) as photos
from public.used_units u
join public.phone_models m on m.id = u.model_id
cross join public.shop_settings settings
where u.is_published = true and m.status = 'available' and m.specs_reviewed = true
  and (u.status in ('available','reserved')
       or (u.status = 'sold' and u.sold_at > now() - make_interval(days => settings.sold_badge_days)));

create view public.public_model_photos with (security_barrier = true) as
select p.id, p.model_id, p.path, p.sort_order, p.is_main, p.alt_text
from public.model_photos p join public.phone_models m on m.id = p.model_id
where m.specs_reviewed = true and m.status in ('available', 'upcoming');

create view public.public_shop_settings with (security_barrier = true) as
select name, currency, phone, whatsapp, telegram, email, address, hours
from public.shop_settings where id = 1;

create view public.public_trade_in_values with (security_barrier = true) as
select id, brand_text, model_text, storage_gb, base_value
from public.trade_in_values where is_active = true;

create view public.public_trade_in_config with (security_barrier = true) as
select config from public.trade_in_config where id = 1;

create view public.admin_used_units with (security_barrier = true) as
select u.id, u.model_id, u.ram_gb, u.storage_gb, u.color_name, u.grade,
       u.battery_health_pct, u.accessories, u.warranty_months, u.price,
       case when public.is_owner() then u.cost_price end as cost_price,
       case when public.is_owner() then u.imei end as imei,
       case when public.is_owner() then u.notes_internal else '' end as notes_internal,
       u.status, u.is_published, u.reserved_until, u.sold_at, u.created_by, u.created_at
from public.used_units u;

revoke select on public.used_units from anon, authenticated;
grant select (id, model_id, ram_gb, storage_gb, color_name, grade, battery_health_pct, accessories, warranty_months, price, status, is_published, reserved_until, sold_at, created_by, created_at) on public.used_units to authenticated;
grant select on public.admin_used_units to authenticated;
grant select on public.public_models, public.public_variants, public.public_used_units, public.public_model_photos, public.public_shop_settings, public.public_trade_in_values, public.public_trade_in_config to anon, authenticated;

create function public.submit_public_lead(p_type public.lead_type, p_name text, p_contact text, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
  normalized_contact text;
begin
  if p_type is null or p_type not in ('trade_in', 'notify_me', 'contact', 'reservation') then
    raise exception 'Invalid lead type';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 then raise exception 'Name is required'; end if;
  if p_contact is null or length(trim(p_contact)) not between 3 and 240 then raise exception 'Contact is required'; end if;
  if p_payload is null or pg_column_size(p_payload) > 16384 then raise exception 'Request is too large'; end if;
  normalized_contact = lower(trim(p_contact));
  perform pg_advisory_xact_lock(hashtextextended(normalized_contact, 0));
  if (select count(*) from public.leads l where lower(l.contact) = normalized_contact and l.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many requests. Please try again later.';
  end if;
  insert into public.leads(type, name, contact, payload) values (p_type, trim(p_name), trim(p_contact), p_payload)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.submit_public_lead(public.lead_type, text, text, jsonb) from public, authenticated;
grant execute on function public.submit_public_lead(public.lead_type, text, text, jsonb) to anon, authenticated;

create function public.sell_variant(p_variant_id uuid, p_quantity integer, p_sale_price numeric, p_buyer_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  item public.variants%rowtype;
  sale_id uuid;
begin
  if not public.is_staff_or_owner() then raise exception 'Not authorized'; end if;
  if p_quantity is null or p_quantity < 1 or p_sale_price is null or p_sale_price <= 0 then raise exception 'Invalid sale'; end if;
  select * into item from public.variants where id = p_variant_id for update;
  if not found then raise exception 'Variant not found'; end if;
  if item.stock_count < p_quantity then raise exception 'Not enough stock'; end if;
  update public.variants set stock_count = stock_count - p_quantity where id = item.id;
  insert into public.sales(kind, variant_id, quantity, sale_price, sold_by, buyer_note)
  values ('new', item.id, p_quantity, p_sale_price, (select auth.uid()), p_buyer_note)
  returning id into sale_id;
  return sale_id;
end;
$$;

create function public.sell_used_unit(p_unit_id uuid, p_sale_price numeric, p_buyer_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  item public.used_units%rowtype;
  sale_id uuid;
begin
  if not public.is_staff_or_owner() then raise exception 'Not authorized'; end if;
  if p_sale_price is null or p_sale_price <= 0 then raise exception 'Invalid sale price'; end if;
  select * into item from public.used_units where id = p_unit_id for update;
  if not found then raise exception 'Unit not found'; end if;
  if item.status = 'sold' then raise exception 'Unit is already sold'; end if;
  if item.status = 'hidden' then raise exception 'Hidden units cannot be sold'; end if;
  update public.used_units set status = 'sold', sold_at = now() where id = item.id;
  insert into public.sales(kind, unit_id, quantity, sale_price, sold_by, buyer_note)
  values ('used', item.id, 1, p_sale_price, (select auth.uid()), p_buyer_note)
  returning id into sale_id;
  return sale_id;
end;
$$;

create function public.undo_sale(p_sale_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  item public.sales%rowtype;
begin
  if not public.is_staff_or_owner() then raise exception 'Not authorized'; end if;
  select * into item from public.sales where id = p_sale_id and undone_at is null for update;
  if not found then raise exception 'Sale not found or already undone'; end if;
  if item.sold_at < now() - interval '24 hours' and not public.is_owner() then raise exception 'Only an owner can undo a sale after 24 hours'; end if;
  if item.kind = 'new' then
    update public.variants set stock_count = stock_count + item.quantity where id = item.variant_id;
  else
    update public.used_units set status = 'available', sold_at = null where id = item.unit_id and status = 'sold';
  end if;
  update public.sales set undone_at = now() where id = item.id;
end;
$$;

create function public.reserve_used_unit(p_unit_id uuid, p_days integer)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  item public.used_units%rowtype;
  expiry timestamptz;
begin
  if not public.is_staff_or_owner() then raise exception 'Not authorized'; end if;
  if p_days is null or p_days < 1 or p_days > 14 then raise exception 'Reservation must be between 1 and 14 days'; end if;
  select * into item from public.used_units where id = p_unit_id for update;
  if not found then raise exception 'Unit not found'; end if;
  if item.status = 'sold' or item.status = 'hidden' then raise exception 'This unit cannot be reserved'; end if;
  if item.status = 'reserved' and item.reserved_until > now() then raise exception 'This unit is already reserved'; end if;
  expiry = now() + make_interval(days => p_days);
  update public.used_units set status = 'reserved', reserved_until = expiry where id = item.id;
  return expiry;
end;
$$;

revoke all on function public.sell_variant(uuid, integer, numeric, text) from public, anon;
revoke all on function public.sell_used_unit(uuid, numeric, text) from public, anon;
revoke all on function public.undo_sale(uuid) from public, anon;
revoke all on function public.reserve_used_unit(uuid, integer) from public, anon;
grant execute on function public.sell_variant(uuid, integer, numeric, text) to authenticated;
grant execute on function public.sell_used_unit(uuid, numeric, text) to authenticated;
grant execute on function public.undo_sale(uuid) to authenticated;
grant execute on function public.reserve_used_unit(uuid, integer) to authenticated;

create function public.create_inventory(p_model jsonb, p_kind text, p_variant jsonb default null, p_unit jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  new_brand_id uuid;
  new_model_id uuid;
  new_unit_id uuid;
begin
  if not public.is_staff_or_owner() then raise exception 'Not authorized'; end if;
  if p_kind not in ('new', 'used', 'upcoming') then raise exception 'Invalid inventory type'; end if;
  if coalesce(p_model ->> 'brand', '') = '' or coalesce(p_model ->> 'name', '') = '' then raise exception 'Brand and model are required'; end if;
  if coalesce(p_model ->> 'slug', '') = '' then raise exception 'Model slug is required'; end if;
  if coalesce((p_model ->> 'published')::boolean, false) and not coalesce((p_model ->> 'specsReviewed')::boolean, false) then
    raise exception 'Confirm model specifications before publishing';
  end if;

  select b.id into new_brand_id from public.brands b where b.name = p_model ->> 'brand';
  if new_brand_id is null then
    insert into public.brands(name, slug)
    values (p_model ->> 'brand', trim(both '-' from regexp_replace(lower(p_model ->> 'brand'), '[^a-z0-9]+', '-', 'g')))
    on conflict (name) do update set name = excluded.name
    returning id into new_brand_id;
  end if;

  insert into public.phone_models(brand_id, name, slug, status, expected_date, expected_price_range, tagline, specs, spec_meta, specs_reviewed, created_by)
  values (
    new_brand_id, p_model ->> 'name', p_model ->> 'slug',
    case when p_kind = 'upcoming' then 'upcoming'::public.model_status else (p_model ->> 'status')::public.model_status end,
    nullif(p_model ->> 'expectedDate', ''), nullif(p_model ->> 'expectedPriceRange', ''), coalesce(p_model ->> 'tagline', ''),
    coalesce(p_model -> 'specs', '{}'::jsonb), coalesce(p_model -> 'specMeta', '{}'::jsonb),
    coalesce((p_model ->> 'specsReviewed')::boolean, false), (select auth.uid())
  )
  returning id into new_model_id;

  if p_kind = 'new' then
    if p_variant is null then raise exception 'New-phone variant details are required'; end if;
    insert into public.variants(model_id, ram_gb, storage_gb, color_name, color_hex, price, old_price, stock_count, low_stock_threshold, is_published)
    values (
      new_model_id, (p_variant ->> 'ramGb')::integer, (p_variant ->> 'storageGb')::integer,
      p_variant ->> 'colorName', coalesce(p_variant ->> 'colorHex', '#777777'),
      (p_variant ->> 'price')::numeric, nullif(p_variant ->> 'oldPrice', '')::numeric,
      (p_variant ->> 'stockCount')::integer, coalesce((p_variant ->> 'lowStockThreshold')::integer, 2),
      coalesce((p_model ->> 'published')::boolean, false)
    );
  elsif p_kind = 'used' then
    if p_unit is null then raise exception 'Used-unit details are required'; end if;
    insert into public.used_units(model_id, ram_gb, storage_gb, color_name, grade, battery_health_pct, accessories, warranty_months, price, cost_price, imei, notes_internal, is_published, created_by)
    values (
      new_model_id, (p_unit ->> 'ramGb')::integer, (p_unit ->> 'storageGb')::integer, p_unit ->> 'colorName',
      (p_unit ->> 'grade')::public.unit_grade, nullif(p_unit ->> 'batteryHealthPct', '')::integer,
      coalesce(p_unit ->> 'accessories', 'Phone only'), coalesce((p_unit ->> 'warrantyMonths')::integer, 0),
      (p_unit ->> 'price')::numeric, nullif(p_unit ->> 'costPrice', '')::numeric,
      nullif(p_unit ->> 'imei', ''), coalesce(p_unit ->> 'notesInternal', ''),
      coalesce((p_model ->> 'published')::boolean, false), (select auth.uid())
    ) returning id into new_unit_id;
  end if;
  return jsonb_build_object('modelId', new_model_id, 'unitId', new_unit_id);
end;
$$;
revoke all on function public.create_inventory(jsonb, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_inventory(jsonb, text, jsonb, jsonb) to authenticated;

create function public.storage_usage_bytes()
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  from storage.objects o
  where o.bucket_id = 'phone-photos' and public.is_owner();
$$;
revoke all on function public.storage_usage_bytes() from public, anon;
grant execute on function public.storage_usage_bytes() to authenticated;

insert into public.shop_settings(id) values (1) on conflict (id) do nothing;
insert into public.trade_in_config(id, config) values (1, '{
  "condition":{"like_new":1,"good":0.9,"fair":0.75,"poor":0.55},
  "screen":{"perfect":1,"light_scratches":0.93,"cracked":0.65},
  "body":{"perfect":1,"scratched":0.92,"cracked_bent":0.75},
  "battery":{"90_plus":1,"80_89":0.94,"below_80":0.85,"unknown":0.92},
  "accessories":{"full":1,"phone_only":0.95},
  "issuePenalty":0.05,"maxIssuePenalty":0.4,"minimumValue":0.1,
  "range":{"min":0.92,"max":1.05}
}'::jsonb) on conflict (id) do nothing;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('phone-photos', 'phone-photos', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy phone_photos_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'phone-photos');
create policy phone_photos_staff_insert on storage.objects for insert to authenticated with check (bucket_id = 'phone-photos' and public.is_staff_or_owner());
create policy phone_photos_staff_update on storage.objects for update to authenticated using (bucket_id = 'phone-photos' and public.is_staff_or_owner()) with check (bucket_id = 'phone-photos' and public.is_staff_or_owner());
create policy phone_photos_staff_delete on storage.objects for delete to authenticated using (bucket_id = 'phone-photos' and public.is_staff_or_owner());
