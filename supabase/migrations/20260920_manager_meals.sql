-- Обеды руководства.
--
-- Руководители едят бесплатно. Раньше это оформлялось бонусами iikoCard и
-- садилось на выручку, искажая отчётность для франчайзера. Теперь в iiko
-- такие заказы закрываются «без оплаты» (на выручку не влияют), а учёт
-- лимитов ведётся здесь.
--
-- База общая с легаси-ботом и v2 — существующие таблицы не трогаем.

create table if not exists public.manager_meals (
  id               uuid primary key default gen_random_uuid(),
  date             date not null,
  manager_name     text not null,
  amount           bigint not null,
  entered_by_tg_id bigint not null,
  entered_by_name  text not null,
  comment          text,
  created_at       timestamptz not null default now()
);

create index if not exists manager_meals_date_idx    on public.manager_meals (date);
create index if not exists manager_meals_manager_idx on public.manager_meals (manager_name);

create table if not exists public.manager_limits (
  manager_name  text primary key,
  monthly_limit bigint not null default 1000000,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Список руководителей. on conflict do nothing — повторный прогон миграции
-- не должен затирать лимиты, изменённые вручную.
insert into public.manager_limits (manager_name, monthly_limit) values
  ('Равшан ака',   1000000),
  ('Шерзод ака',   1000000),
  ('Азамат ака',   1000000),
  ('Нуриддин ака', 1000000),
  ('Нодир ака',    1000000)
on conflict (manager_name) do nothing;
