# AGENTS.md — regras do projeto

Projeto-base de site institucional com CMS próprio. **Uma instalação independente por cliente.** Não é SaaS nem multi-tenant: não implemente nada disso.

## Antes de começar qualquer tarefa
1. Leia `README.md` e `docs/ROADMAP.md`.
2. Trabalhe em **uma etapa por vez**, na ordem do roadmap. Não antecipe etapas futuras.
3. Se algo no roadmap for ambíguo, proponha a decisão em poucas linhas antes de implementar.

## Stack
- Front: React, Vite, TypeScript, Tailwind (v3), React Router, Lucide.
- Back: Node 20, Express, TypeScript (ESM, imports com extensão `.js`), API REST.
- Banco: MySQL 8 via `mysql2` (queries parametrizadas, sempre).
- Validação: Zod.
- Monorepo npm workspaces: `apps/api`, `apps/web` (e `packages/shared` quando criado).

## Comandos
- `npm run setup` migrations + seeds + master (usa `.env`)
- `npm run dev:api` / `npm run dev:web`
- `npm run typecheck -w apps/api` e `-w apps/web`
- `npm run build`

## Regras de segurança (inegociáveis)
- Toda rota que lê dado privado ou altera algo usa `requireAuth` + `requirePermission(...)` **no back-end**. Esconder botão no front não conta.
- Rotas que alteram dados já passam por `csrfProtection` (header `X-CSRF-Token`). Não desligue.
- Nunca concatene valores em SQL. Use `?`.
- Todo input passa por schema Zod. Falha vira 400 com `fields`.
- Ações relevantes chamam `audit()`.
- Sem credenciais, `.env` ou dados de cliente no repositório. Seeds são genéricos.
- Uploads ficam fora do webroot, validados por magic bytes, com nome gerado.
- Permissões novas entram **só** em `apps/api/src/lib/permissions.ts`; as `masterOnly` nunca são concedidas a clientes.

## Convenções de código
- Um diretório por módulo em `apps/api/src/modules/<nome>` (`<nome>.routes.ts`, e `service`/`repository` quando houver regra de negócio).
- Regra de negócio fora dos componentes React. Componentes só apresentam.
- Dados de página (títulos, textos, imagens) **nunca** fixos no código: vêm do banco.
- Arquivos pequenos e focados; sem código duplicado.
- Mudança de schema = nova migration `NNN_nome.sql` em `apps/api/src/db/migrations`. **Nunca edite migrations já aplicadas.**
- Respostas de erro em português, sem vazar detalhes internos em produção.
- Evite dependências externas em runtime (CDNs, fontes remotas).

## Definição de pronto de uma etapa
- `typecheck` e `build` passam.
- Critérios de aceite da etapa no `docs/ROADMAP.md` verificados manualmente ou por teste.
- `README.md` (tabela de status) e `docs/` atualizados.
- Nenhum segredo ou arquivo de upload no diff.

## Estado atual
Etapas 1 a 3 prontas (banco, auth, permissões, dashboard base). Próxima: Etapa 4.
