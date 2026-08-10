-- Сессии инвентаризации ОС.
--
-- До этого от обхода оставалась только отметка `assets.last_inventoried_at`:
-- нельзя было ответить, кто проводил, когда закончил и чего НЕ нашли. Список
-- ненайденного жил в браузере до нажатия кнопки — закрыл вкладку, и недостача
-- исчезла. Теперь обход — документ.
--
-- Таблица наша, легаси о ней не знает: своих вставок туда нет, ALTER общих
-- таблиц не делаем.
create table if not exists asset_audits (
  id           uuid primary key default gen_random_uuid(),
  filial_id    integer not null,
  -- Обходят по одному помещению за раз. NULL — обход всего сразу.
  location_id  uuid references asset_locations(id) on delete set null,
  started_by   text not null default '',
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  -- Что нашли и чего не хватило. Фиксируется в момент закрытия — это и есть
  -- акт. Единиц под сотню и филиал один, поэтому jsonb честнее отдельной
  -- таблицы позиций: джойны по строкам обхода всё равно не нужны.
  scanned      jsonb not null default '[]'::jsonb,
  missing      jsonb not null default '[]'::jsonb,
  note         text not null default ''
);

create index if not exists asset_audits_filial_idx on asset_audits (filial_id, started_at desc);
