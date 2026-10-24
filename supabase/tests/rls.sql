begin;

create extension if not exists pgtap with schema extensions;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('d7dd9e4b-64e3-437f-a3a7-4fd683af6431', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-owner@example.test', '', now(), now(), now()),
  ('6d1d4eec-f6ec-4a48-b4d7-2cd1ac767d2b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-staff@example.test', '', now(), now(), now());

insert into public.profiles (id, full_name, role) values
  ('d7dd9e4b-64e3-437f-a3a7-4fd683af6431', 'RLS test owner', 'owner'),
  ('6d1d4eec-f6ec-4a48-b4d7-2cd1ac767d2b', 'RLS test staff', 'staff');

insert into public.brands (id, name, slug)
values ('21a381d3-2973-4b3a-8928-0ae54d5d0092', 'RLS test brand', 'rls-test-brand');
insert into public.phone_models (id, brand_id, name, slug, specs_reviewed)
values ('22a381d3-2973-4b3a-8928-0ae54d5d0092', '21a381d3-2973-4b3a-8928-0ae54d5d0092', 'RLS test phone', 'rls-test-phone', true);
insert into public.used_units (id, model_id, ram_gb, storage_gb, color_name, grade, price, cost_price, imei, notes_internal)
values ('23a381d3-2973-4b3a-8928-0ae54d5d0092', '22a381d3-2973-4b3a-8928-0ae54d5d0092', 8, 128, 'Black', 'A', 10000, 7000, '12345678901234', 'owner-only fixture');

select extensions.plan(5);

set local role authenticated;
select set_config('request.jwt.claim.sub', '6d1d4eec-f6ec-4a48-b4d7-2cd1ac767d2b', true);
select extensions.throws_ok(
  $$select cost_price from public.used_units where id = '23a381d3-2973-4b3a-8928-0ae54d5d0092'$$,
  '42501',
  null,
  'staff cannot select confidential used-unit columns'
);
select extensions.throws_ok(
  $$insert into public.used_units (model_id, ram_gb, storage_gb, color_name, grade, price, cost_price) values ('22a381d3-2973-4b3a-8928-0ae54d5d0092', 8, 128, 'Blue', 'B', 8000, 5000)$$,
  null,
  'Only an owner can set private used-phone fields',
  'staff cannot create used units with a private cost'
);
update public.profiles set role = 'owner' where id = '6d1d4eec-f6ec-4a48-b4d7-2cd1ac767d2b';
reset role;
select extensions.is(
  (select role::text from public.profiles where id = '6d1d4eec-f6ec-4a48-b4d7-2cd1ac767d2b'),
  'staff',
  'staff cannot promote their own account'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd7dd9e4b-64e3-437f-a3a7-4fd683af6431', true);
select extensions.is(
  (select cost_price from public.admin_used_units where id = '23a381d3-2973-4b3a-8928-0ae54d5d0092'),
  7000::numeric,
  'owner can read confidential cost through the admin view'
);
select extensions.is(
  (select count(*)::integer from public.public_used_units where id = '23a381d3-2973-4b3a-8928-0ae54d5d0092'),
  0,
  'unpublished fixture remains hidden from public catalog'
);

select * from extensions.finish();
rollback;
