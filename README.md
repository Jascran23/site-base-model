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
| 6 | Editor de seções e modelos | ✅ implementada (4 seções de referência) |
| 7 | Personalização de tema | ✅ implementada |
| 8 | Site público dinâmico | ⚙️ SSR implementado; Lighthouse pendente |
| 9 | SEO, formulários, configurações | ⏳ tabelas prontas |
| 10 | Segurança final, testes, hospedagem | ⏳ |

## Estrutura
```
apps/api/src
  config/env.ts        variáveis de ambiente validadas (Zod)
  db/                  pool, migrate.ts, seed.ts, migrations/*.sql
  lib/                 permissions.ts (catálogo), password, audit, errors, defaults
  middleware/          auth (sessão, permissões, CSRF), error
  modules/             auth · users · dashboard · media · pages · templates · theme
  scripts/create-master.ts
apps/web/src
  admin/               layout, páginas do painel e biblioteca de imagens
  public/              componentes públicos e hidratação SSR
  lib/                 api (fetch + CSRF), auth (contexto)
packages/shared        schemas e tipos compartilhados entre API e web
storage/uploads        arquivos enviados (fora do webroot)
docs/INSTALACAO.md
```

Etapa 6: registry extensível com schemas Zod, editor com autosave concorrente e modelos por segmento. As seções implementadas como referência são hero, sobre, serviços e contato; as demais do roadmap aguardam validação do padrão.

Etapa 7: tema em rascunho/publicado, CSS vars compartilhadas, controles de cores, tipografia, botões, bordas, sombras e espaçamento, preview ao vivo, contraste e logotipo/favicon via biblioteca. O master configura os grupos que cada cliente pode editar.

Etapa 8: o Express serve o site com SSR usando os mesmos componentes React e hidrata no navegador. O processo também serve o painel e os assets compilados; em desenvolvimento, `localhost:3001` entrega SSR e `localhost:5173` mantém HMR do painel.

## Rodar em desenvolvimento
Veja `docs/INSTALACAO.md`. Resumo: `cp .env.example .env` → editar → `npm install` → `npm run setup` → `npm run dev:api` e `npm run dev:web`.
