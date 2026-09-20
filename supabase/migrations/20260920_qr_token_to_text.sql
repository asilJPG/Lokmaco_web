-- Переводим qr_token с uuid на text, чтобы хранить card_number из iikoCard.
-- Старые QR руководителей остаются рабочими — в них зашит card_number.

drop index if exists public.manager_limits_qr_token_idx;

alter table public.manager_limits
  alter column qr_token drop default,
  alter column qr_token type text using qr_token::text;

create unique index manager_limits_qr_token_idx
  on public.manager_limits (qr_token);
