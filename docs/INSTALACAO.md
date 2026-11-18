# Instalação

## Requisitos
Node 20+, MySQL 8 (ou MariaDB 10.6+), processo Node persistente (PM2/systemd), proxy reverso com HTTPS (Nginx/Caddy), disco gravável para `storage/uploads`.
Hospedagem compartilhada sem Node **não** serve.

## Passo a passo
1. Crie o banco e um usuário MySQL dedicado (utf8mb4).
2. `cp .env.example .env` e preencha. Gere o segredo:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. `npm install`
4. `npm run setup` — roda migrations, seeds e cria o master a partir de `MASTER_*`.
5. **Remova `MASTER_PASSWORD` do `.env`.**
6. Desenvolvimento: `npm run dev:api` (API e site com SSR em `http://localhost:3001`) e `npm run dev:web` (painel com HMR em `http://localhost:5173`, com proxy para `/api`).
7. Produção: `npm run build`; `node apps/api/dist/server.js` sob PM2. O processo da API serve o site SSR, o painel e os assets de `apps/web/dist`; configure o Nginx para encaminhar as requisições ao processo Node. Defina `SITE_URL` com a URL pública e `NODE_ENV=production` (cookie `Secure` e `trust proxy`).

## Novo cliente (duplicação)
1. Copie o repositório **limpo** (sem `.env`, sem `storage/uploads/*`, sem `node_modules`).
2. Crie banco e `.env` novos. Rode `npm run setup`.
3. Nenhum dado do cliente anterior existe no código: tudo mora no banco da instalação.

## Atualizar instalações existentes
Novas migrations ficam em `apps/api/src/db/migrations/NNN_nome.sql`. `npm run migrate` aplica só as pendentes.

## Permissões
Catálogo em `apps/api/src/lib/permissions.ts`. Para criar uma nova: adicione no arquivo, rode `npm run seed` e proteja a rota com `requirePermission('chave')`.
Permissões `masterOnly` nunca podem ser concedidas a administradores de cliente.
