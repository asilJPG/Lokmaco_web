-- QR-код руководителя для обедов.
--
-- Кассир сканирует код — система сама понимает, кто перед ним, и показывает
-- остаток лимита. При ручном выборе из списка остаток кассиру не показывается:
-- QR подтверждает, что руководитель рядом и сам предъявил код.

alter table public.manager_limits
  add column if not exists qr_token uuid not null default gen_random_uuid();

create unique index if not exists manager_limits_qr_token_idx
  on public.manager_limits (qr_token);
