# CMS Base — site institucional dinâmico

Projeto-base reutilizável: **uma instalação independente por cliente** (site, painel, banco MySQL, usuários, imagens e tema próprios). Não é SaaS nem multi-tenant.

**Stack:** React + Vite + TypeScript + Tailwind + React Router + Lucide · Node + Express + TypeScript · MySQL.

## Status por etapa
| Etapa | Escopo | Status |
|---|---|---|
| 1 | Arquitetura, estrutura, banco (migrations + seeds) | ✅ pronta e testada |
| 2 | Autenticação e permissões | ✅ pronta e testada |
| 3 | Dashboard administrativo | ✅ base pronta (contagens, recentes, atividades) |
| 4 | Biblioteca de imagens | ✅ pronta e testada |
| 5 | Páginas | ✅ pronta e testada |
| 6 | Editor de seções | ⏳ |
| 7 | Tema | ⏳ tokens padrão no seed |
| 8 | Site público dinâmico | ⏳ placeholder |
| 9 | SEO, formulários, configurações | ⏳ tabelas prontas |
| 10 | Segurança final, testes, hospedagem | ⏳ |

## Estrutura
```
apps/api/src
  config/env.ts        variáveis de ambiente validadas (Zod)
  db/                  pool, migrate.ts, seed.ts, migrations/*.sql
  lib/                 permissions.ts (catálogo), password, audit, errors, defaults
  middleware/          auth (sessão, permissões, CSRF), error
  modules/             auth · users · dashboard · media · pages
  scripts/create-master.ts
apps/web/src
  admin/               layout, páginas do painel e biblioteca de imagens
  public/              site público (Etapa 8)
  lib/                 api (fetch + CSRF), auth (contexto)
packages/shared        schemas e tipos compartilhados entre API e web
storage/uploads        arquivos enviados (fora do webroot)
docs/INSTALACAO.md
```

## Rodar em desenvolvimento
Veja `docs/INSTALACAO.md`. Resumo: `cp .env.example .env` → editar → `npm install` → `npm run setup` → `npm run dev:api` e `npm run dev:web`.
