-- ============================================================
-- ENG.M.A.P.A V6 — BANCO DE DADOS SUPABASE
-- Execute este arquivo no SQL Editor do Supabase.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  documento text unique,
  role text not null default 'cliente' check (role in ('cliente','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  municipio text,
  matricula text,
  area_hectares numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  nome_servico text not null,
  detalhes text,
  status text not null default 'Solicitado',
  publicar_portfolio boolean not null default false,
  completed_at timestamptz,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  categoria text not null,
  descricao text,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);

-- Migrações seguras para projetos já existentes
alter table public.properties add column if not exists area_hectares numeric;
alter table public.services add column if not exists publicar_portfolio boolean not null default false;
alter table public.services add column if not exists completed_at timestamptz;

-- Visão pública controlada: somente serviços finalizados explicitamente autorizados.
create or replace view public.clientes_servicos_finalizados as
select
  p.nome as nome_cliente,
  pr.nome as nome_propriedade,
  pr.municipio,
  pr.area_hectares,
  pr.matricula,
  s.nome_servico,
  s.detalhes,
  coalesce(s.completed_at, s.updated_at, s.requested_at) as finalizado_em
from public.services s
join public.profiles p on p.id = s.cliente_id
left join public.properties pr on pr.id = s.property_id
where s.status = 'Finalizado' and s.publicar_portfolio = true;

grant select on public.clientes_servicos_finalizados to anon, authenticated;
create index if not exists services_finalized_public_idx on public.services(status, publicar_portfolio);
create index if not exists properties_cliente_idx on public.properties(cliente_id);

-- Trigger: cria perfil automaticamente após cadastro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, telefone, documento)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'telefone',
    nullif(new.raw_user_meta_data->>'documento', '')
  )
  on conflict (id) do update set
    nome = excluded.nome,
    telefone = excluded.telefone,
    documento = excluded.documento,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.services enable row level security;
alter table public.documents enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profile own read" on public.profiles;
create policy "profile own read" on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profile own update" on public.profiles;
create policy "profile own update" on public.profiles
for update using (id = auth.uid() or public.is_admin());

drop policy if exists "profile admin insert" on public.profiles;
create policy "profile admin insert" on public.profiles
for insert with check (id = auth.uid() or public.is_admin());

drop policy if exists "properties client/admin read" on public.properties;
create policy "properties client/admin read" on public.properties
for select using (cliente_id = auth.uid() or public.is_admin());

drop policy if exists "properties client insert" on public.properties;
create policy "properties client insert" on public.properties
for insert with check (cliente_id = auth.uid() or public.is_admin());

drop policy if exists "properties owner update" on public.properties;
create policy "properties owner update" on public.properties
for update using (cliente_id = auth.uid() or public.is_admin());

drop policy if exists "properties owner delete" on public.properties;
create policy "properties owner delete" on public.properties
for delete using (cliente_id = auth.uid() or public.is_admin());

drop policy if exists "services client/admin read" on public.services;
create policy "services client/admin read" on public.services
for select using (cliente_id = auth.uid() or public.is_admin());

drop policy if exists "services client insert" on public.services;
create policy "services client insert" on public.services
for insert with check (cliente_id = auth.uid() or public.is_admin());

drop policy if exists "services admin update" on public.services;
create policy "services admin update" on public.services
for update using (public.is_admin());

drop policy if exists "documents client/admin read" on public.documents;
create policy "documents client/admin read" on public.documents
for select using (cliente_id = auth.uid() or public.is_admin());

drop policy if exists "documents admin insert" on public.documents;
create policy "documents admin insert" on public.documents
for insert with check (public.is_admin());

drop policy if exists "documents admin update" on public.documents;
create policy "documents admin update" on public.documents
for update using (public.is_admin());

drop policy if exists "documents admin delete" on public.documents;
create policy "documents admin delete" on public.documents
for delete using (public.is_admin());

-- Storage privado para documentos dos clientes.
insert into storage.buckets (id, name, public)
values ('documentos-clientes', 'documentos-clientes', false)
on conflict (id) do nothing;

drop policy if exists "storage client read own folder" on storage.objects;
create policy "storage client read own folder"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documentos-clientes'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "storage admin upload" on storage.objects;
create policy "storage admin upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documentos-clientes'
  and public.is_admin()
);

drop policy if exists "storage admin update" on storage.objects;
create policy "storage admin update"
on storage.objects for update
to authenticated
using (bucket_id = 'documentos-clientes' and public.is_admin())
with check (bucket_id = 'documentos-clientes' and public.is_admin());

drop policy if exists "storage admin delete" on storage.objects;
create policy "storage admin delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'documentos-clientes' and public.is_admin());

-- Após criar seu usuário pelo site, torne-o administrador:
-- update public.profiles set role = 'admin' where email = 'SEU_EMAIL_ADMIN';
