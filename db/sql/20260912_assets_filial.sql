-- Опись ОС — по филиалам.
--
-- Три таблицы: assets, asset_tags, asset_locations — общие с легаси и жили
-- без filial_id. Пока филиал был один, это работало, но Самарканд открывает
-- сайт и видит фергантское оборудование — так нельзя.
--
-- ⚠️ `NOT NULL DEFAULT 1` намеренно: легаси инсертит без этого поля (см.
-- `_legacy/lib/supabase.js`, POST в `asset_tags` / `asset_locations` не
-- передаёт filial), и без дефолта его записи упали бы 500. Единственный
-- активный филиал у легаси — Fergana (id = 1); туда и уходит всё, что
-- легаси пишет.
--
-- Ссылку на `filials` не ставим специально: старая база к этой таблице
-- ограничения не имеет по разным местам, ссылка бы заставила прибирать
-- полуразобранные записи при миграциях.

ALTER TABLE assets           ADD COLUMN IF NOT EXISTS filial_id integer NOT NULL DEFAULT 1;
ALTER TABLE asset_tags       ADD COLUMN IF NOT EXISTS filial_id integer NOT NULL DEFAULT 1;
ALTER TABLE asset_locations  ADD COLUMN IF NOT EXISTS filial_id integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS assets_filial_idx          ON assets (filial_id);
CREATE INDEX IF NOT EXISTS asset_tags_filial_idx      ON asset_tags (filial_id);
CREATE INDEX IF NOT EXISTS asset_locations_filial_idx ON asset_locations (filial_id);
