# Lokmaco v2

Next.js 14 (App Router, TS strict) · Drizzle ORM · PostgreSQL (Supabase) · SimpleWebAuthn (passkeys) · iiko XML/JSON API.

Подробности архитектуры — см. [context.md](./context.md).

## Локальная разработка

```bash
npm install
cp .env.example .env   # заполнить реальными значениями
npm run dev
```

## Деплой (Vercel + Supabase)

1. **Supabase**: используется существующий проект (Transaction pooler, порт 6543 — direct connection на 5432 не резолвится для новых проектов). `DATABASE_URL` в `.env`/Vercel env — pooler-строка.
2. **Vercel**:
   - Импортировать репозиторий, ветка деплоя — `v2-rewrite` (не `main` — там легаси-сайт).
   - Root directory — если репозиторий общий с легаси через git worktree, указать соответствующий путь/ветку в настройках проекта Vercel.
   - Добавить все переменные из `.env.example` в Vercel → Project → Settings → Environment Variables.
   - Build command: `next build` (по умолчанию). Node 18+.
3. **Первый деплой**: после билда проверить `/login` → вход по коду доступа → passkey регистрация (WebAuthn требует HTTPS-домен, `RP_ID`/`RP_ORIGIN` должны совпадать с реальным доменом Vercel).
4. **Общая БД с легаси**: `web_lokmaco3` (старый сайт, ветка `main`) пишет в ту же Supabase-базу через REST API напрямую. Любое изменение схемы (ALTER/новые NOT NULL колонки) обязано быть совместимо с легаси-инсертами — см. `_legacy/` и `lib/supabase.js` в старом проекте перед миграциями.

## Проверка перед релизом

```bash
npx tsc --noEmit
npm run build
```
