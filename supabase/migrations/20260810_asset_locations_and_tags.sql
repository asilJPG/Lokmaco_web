-- Места размещения ОС и универсальные QR-наклейки.
--
-- База общая с легаси-ботом, поэтому существующие таблицы не трогаем:
-- только добавляем новые и одну нерушимую колонку в assets.

-- 1. Справочник мест. Плоский список: «Кухня», «Бар», «Зал», «Подвал».
create table if not exists asset_locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  note        text not null default '',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- Название места уникально без учёта регистра и пробелов по краям,
-- иначе «Бар» и «бар » расползутся в две разные папки.
create unique index if not exists asset_locations_name_uniq
  on asset_locations (lower(btrim(name)));

-- 2. Где стоит карточка. Старое текстовое поле assets.location не трогаем:
-- в него пишет легаси, и ломать его нельзя.
alter table assets
  add column if not exists location_id uuid references asset_locations(id) on delete set null;

create index if not exists assets_location_id_idx on assets (location_id);

-- 3. Универсальные наклейки. Печатаются пачкой пустыми, привязка к
-- конкретной единице происходит при сканировании на месте.
create table if not exists asset_tags (
  code        text primary key,
  asset_id    uuid references assets(id) on delete set null,
  batch       text not null default '',
  bound_at    timestamptz,
  bound_by    text,
  created_at  timestamptz not null default now()
);

-- Одна единица — одна наклейка: не даём привязать вторую к тому же ОС.
-- Свободных наклеек (asset_id is null) при этом может быть сколько угодно.
create unique index if not exists asset_tags_asset_uniq
  on asset_tags (asset_id) where asset_id is not null;

create index if not exists asset_tags_batch_idx on asset_tags (batch);
create index if not exists asset_tags_free_idx  on asset_tags (code) where asset_id is null;
