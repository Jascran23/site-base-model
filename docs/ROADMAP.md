# Mapa das etapas restantes (4 a 10)

Como usar com o Codex: **uma etapa por vez, uma branch por etapa** (`etapa-04-imagens`). Cole o prompt da etapa, revise o diff, rode os critérios de aceite e só então faça merge. Leia sempre `AGENTS.md` antes (o Codex o lê sozinho).

Estado atual: Etapas 1, 2 e 3 prontas (banco, auth, permissões, dashboard base). A implementação da Etapa 4 está concluída; faltam os critérios de aceite que dependem de executar a API com MySQL e uma sessão de cliente. A migration `001_init.sql` não foi alterada. Todas as tabelas das próximas etapas **já existem** nela; mudanças de schema entram em migrations novas (`002_...sql`), nunca editando a 001.

Decisão D1 para esta execução: `packages/shared` fica para a Etapa 5, quando schemas e tipos passam a ser compartilhados entre API e front. A Etapa 4 não precisa desse pacote.

Verificação da Etapa 4: `typecheck` de API e web e `npm run build` passam. Pendente validar em ambiente com banco: rejeição de arquivo falso, resposta 413, exclusão 409/remoção dos arquivos, substituição preservando o ID e permissão de upload (403).

## Decisões a tomar antes de começar

| # | Decisão | Recomendação | Afeta |
|---|---|---|---|
| D1 | Pacote `packages/shared` (schemas Zod das seções, tipos, gerador de CSS vars) | Criar na Etapa 4 ou 5; front e API validam com o mesmo schema | 5, 6, 7, 8 |
| D2 | Renderização do site público | SSR com Vite SSR dentro do mesmo processo Node da API | 8, 9 |
| D3 | Header e rodapé: por página ou globais? | Globais, guardados em `site_settings` (`layout`) | 6, 8 |
| D4 | Drag-and-drop do editor | `@dnd-kit` (acessível, sem dependência externa em runtime) | 6 |
| D5 | Fontes | Lista curta de fontes do sistema + opção de fonte self-hosted (sem Google Fonts, por LGPD e independência) | 7 |
| D6 | Envio de e-mail | `nodemailer` com SMTP configurável por `.env`; opcional | 9 |

---

## Etapa 4. Biblioteca de imagens (≈ 1,5 semana)

**Objetivo:** upload seguro, organização, uso rastreado, seletor reutilizável.

**Back-end (`modules/media`)**
- Deps: `multer` (memória), `file-type` (magic bytes), `sharp`.
- `POST /api/media` upload: valida MIME real (jpeg, png, webp, gif, svg só se sanitizado, ou bloquear svg na v1), limite `MAX_UPLOAD_MB`, nome `uuid.ext`, reprocessa com sharp (remove EXIF, gera WebP e miniatura 400px), grava em `STORAGE_DIR`, registra width/height em `media`.
- `GET /api/media` (busca `q`, `category_id`, paginação), `GET /api/media/:id`, `PATCH /api/media/:id` (alt, categoria).
- `POST /api/media/:id/replace`: troca o arquivo mantendo o mesmo `id` (as páginas que usam não quebram).
- `DELETE /api/media/:id`: **409** se existir em `media_usages`.
- `GET /api/media/:id/usages`: onde a imagem é usada.
- CRUD de `media_categories`.
- Servir arquivos: rota estática só para `STORAGE_DIR`, com `X-Content-Type-Options: nosniff`, sem listar diretório, sem executar nada.
- Util `syncMediaUsages(entityType, entityId, mediaIds[])` (usado nas etapas 5 a 7).

**Permissões:** `media.view`, `media.select`, `media.upload`, `media.delete`.

**Front:** tela Biblioteca (grade, busca, categorias, arrastar para enviar, detalhes com "usada em"), e componente `MediaPicker` (modal) reutilizado por todo campo de imagem.

**Aceite**
- `.php` renomeado para `.jpg` é rejeitado; arquivo acima do limite retorna 413.
- Excluir imagem em uso retorna 409; sem uso, exclui arquivo e miniatura do disco.
- Substituir imagem mantém o id e atualiza o arquivo.
- Cliente sem `media.upload` recebe 403 no upload.

**Prompt para o Codex**
> Leia AGENTS.md e docs/ROADMAP.md. Implemente a Etapa 4 (biblioteca de imagens) em `apps/api/src/modules/media` e `apps/web/src/admin/pages/Media.tsx` + `MediaPicker`. Siga os endpoints e critérios de aceite do roadmap. Não altere a migration 001. Rode typecheck e teste manualmente os critérios.

---

## Etapa 5. Gerenciamento de páginas (≈ 1,5 semana)

**Objetivo:** CRUD de páginas com rascunho x publicado, SEO por página e preview.

**Back-end (`modules/pages`)**
- `GET/POST /api/pages`, `PATCH /api/pages/:id` (título, slug, SEO), `DELETE`, `POST /:id/duplicate`.
- `GET/PUT /api/pages/:id/draft`: conteúdo `{ sections: [...] }` validado por schema (na Etapa 5 aceita seções genéricas; a Etapa 6 endurece por tipo). Cada PUT cria `page_versions` kind `draft`.
- `POST /:id/publish` (cria versão `published`, atualiza `published_version_id`, `status`), `POST /:id/unpublish`, `POST /:id/set-home` (transação: só uma home).
- `POST /:id/preview-token` (token HMAC com expiração de 15 min); `GET /api/preview/:token` devolve o rascunho.
- Slug: único, minúsculo, sem acentos, **reservados** (`admin`, `api`, `uploads`, `sitemap.xml`, `robots.txt`).
- Ao salvar/publicar: `syncMediaUsages` com as imagens do conteúdo e do SEO.
- Auditoria de tudo (`audit()`).

**Permissões:** `pages.view/create/edit/delete/publish`, `seo.edit`.

**Front:** lista (filtro por status, busca, ações rápidas), formulário de criar (em branco ou de modelo, quando existirem), tela de configurações da página (slug, SEO), botão Visualizar.

**Aceite**
- Slug duplicado ou reservado retorna 409/400.
- Publicar não altera o rascunho; editar rascunho não altera o publicado.
- Definir home desmarca a anterior.
- Cliente sem `pages.publish` salva rascunho mas não publica (403).
- Excluir página remove usos de mídia associados.

**Prompt**
> Implemente a Etapa 5 (páginas) conforme docs/ROADMAP.md. Crie `modules/pages` na API e as telas Pages/PageSettings no painel. Rascunho e publicado vivem em `page_versions`. Use transações para publish e set-home. Reaproveite `syncMediaUsages`.

---

## Etapa 6. Editor de seções e modelos (≈ 3 semanas, a maior)

**Objetivo:** editor por componentes reutilizáveis, extensível sem reescrever o editor.

**Registry de seções (`packages/shared/sections/*`)** — um arquivo por seção exportando:
`type`, `label`, `schemaVersion`, `propsSchema` (Zod), `defaultProps`, `fields` (descritor para gerar o formulário: texto, textarea, imagem, link, botão, cor, lista repetível, toggle) e `editableByClient` (quais campos o cliente pode mexer).
Componentes iniciais: header, hero, about, services, specialties, team, differentials, gallery, testimonials, reviews, faq, cta, contact, footer. Header e footer são globais (D3).

**Editor (front)**
- Painel de seções: adicionar (catálogo), remover, duplicar, reordenar (D4), ocultar.
- Formulário lateral gerado a partir de `fields`; campos de imagem usam `MediaPicker`.
- Preview ao vivo reutilizando os mesmos componentes públicos num iframe/área isolada.
- Autosave do rascunho com debounce e controle de concorrência (enviar `baseVersionId`; se mudou, avisar).

**Back-end:** o PUT do rascunho passa a validar cada seção pelo `propsSchema` do seu tipo e `schemaVersion`; seção desconhecida ou props inválidos retornam 400 com o caminho do erro. Sanitizar HTML de campos de texto rico (`sanitize-html`).

**Modelos (`modules/templates`, master)**
- CRUD de `templates` (página e seção); "salvar página como modelo"; criar página a partir de modelo.
- Seeds de modelos por segmento: advocacia (Início, Sobre, Áreas de atuação, Equipe, Contato), saúde (Início, Sobre, Especialidades, Profissionais, Estrutura, Contato), institucional (Início, Sobre, Serviços, Diferenciais, Portfólio, Contato). Texto genérico, sem nome de cliente.

**Aceite**
- Adicionar um 15º tipo de seção = criar um arquivo no registry e registrar; nenhum arquivo do editor muda.
- Cliente só vê/edita os campos marcados `editableByClient`, e o back-end rejeita alteração dos demais.
- Props inválidos são rejeitados na API, não só na tela.
- Criar página de modelo gera conteúdo editável independente do modelo.

**Prompt**
> Implemente a Etapa 6. Primeiro crie `packages/shared` com o registry de seções (Zod + descritor de campos) e só depois o editor. Implemente 4 seções (hero, about, services, contact) completas como referência e deixe as demais para eu validar o padrão antes de replicar.

*(Dica: peça ao Codex para fechar o padrão em 4 seções antes das 14. Reduz retrabalho.)*

---

## Etapa 7. Personalização de tema (≈ 1,5 semana)

**Objetivo:** aparência por variáveis CSS, com rascunho, preview e publicação.

- `GET/PUT /api/theme/draft`, `POST /api/theme/publish` (tabela `theme_settings`, linhas `draft` e `published`), `POST /api/theme/reset`.
- Validação Zod dos tokens (cores em hex, tamanhos com limites, fonte da lista permitida).
- Util compartilhado `themeToCssVars(tokens)` gera `--color-primary`, `--font-heading`, `--radius-md`, `--shadow-md`, `--space-section` etc.
- Logotipo e favicon via `MediaPicker` (registrar em `media_usages` tipo `theme`).
- Cliente edita só os grupos liberados pelo master (guardar em `site_settings.theme_client_groups`).
- Front: tela Aparência com seletores de cor, tipografia, botões, bordas, sombras, espaçamento; preview ao vivo; aviso de contraste baixo (WCAG).
- Tailwind do site público usa as variáveis (`bg-[var(--color-primary)]` ou classes mapeadas no config).

**Aceite:** trocar a cor primária no rascunho muda só o preview; publicar muda o site; resetar volta ao padrão; cliente sem grupo liberado recebe 403 ao tentar alterá-lo.

**Prompt**
> Implemente a Etapa 7 (tema). Tokens em `theme_settings`, util `themeToCssVars` em packages/shared, tela Aparência com preview ao vivo. Fontes apenas da lista do sistema, sem Google Fonts.

---

## Etapa 8. Site público dinâmico (≈ 2 semanas)

**Objetivo:** servir as páginas publicadas, com HTML já renderizado para SEO.

- SSR (D2): entrada `entry-server.tsx` renderiza a árvore de seções; o Express responde o HTML completo, depois o React hidrata.
- `GET /api/public/site` (tema publicado, header/footer, configurações comerciais) e `GET /api/public/pages/:slug` (só `published`; rascunho nunca vaza).
- Rotas públicas: `/` (página home), `/:slug`, 404 amigável.
- Variáveis CSS do tema injetadas no `<head>` do HTML (sem flash).
- Cache: ETag/`Cache-Control` curto, invalidado ao publicar.
- Imagens com `width/height`, `loading="lazy"` e `srcset` com as miniaturas.
- Preview autenticado por token (da Etapa 5) renderiza o rascunho.

**Aceite:** `curl` da URL pública já mostra o texto da página no HTML; página em rascunho retorna 404; publicar reflete em segundos; Lighthouse acima de 90 em SEO e acessibilidade na página de exemplo.

**Prompt**
> Implemente a Etapa 8 com Vite SSR integrado ao Express (um único processo). O site público só lê dados publicados. Injete as variáveis CSS do tema no head e garanta que `curl` retorne o conteúdo da página no HTML.

---

## Etapa 9. SEO, formulários e configurações (≈ 2 semanas)

**SEO**
- Meta tags por página no SSR: title, description, canonical, Open Graph, imagem de compartilhamento, `noindex`.
- `GET /sitemap.xml` (só páginas publicadas e indexáveis) e `GET /robots.txt` (usa `SITE_URL`).
- JSON-LD por segmento (`LegalService`, `MedicalBusiness`/`Physician`, `Organization`) a partir das configurações comerciais.
- Tela SEO no painel (visão geral das páginas com title/description faltando).

**Formulários**
- `POST /api/public/forms/:id/submit`: campos dinâmicos validados por Zod gerado de `form_definitions.fields`, honeypot, rate limit por IP, checkbox de consentimento LGPD obrigatório.
- Salva em `form_submissions` (IP só em hash); e-mail ao destinatário via SMTP (D6), com falha de e-mail não perdendo a mensagem.
- Caixa de entrada no painel (`forms.view`), com exportação e exclusão.
- Preparar botão/link de WhatsApp (`https://wa.me/...`) vindo das configurações.

**Configurações**
- Informações comerciais (`settings.business`: nome, telefones, endereço, horários, redes) e parâmetros técnicos (`settings.technical`, só master: SMTP, retenção de mensagens, limites).

**Aceite:** sitemap lista só publicadas; página `noindex` fora do sitemap; envio sem consentimento falha; spam por honeypot é descartado em silêncio; e-mail fora do ar ainda grava a mensagem.

**Prompt**
> Implemente a Etapa 9: SEO no SSR, sitemap/robots, JSON-LD, formulários públicos com honeypot, rate limit e consentimento LGPD, caixa de entrada no painel e telas de configurações. E-mail via nodemailer opcional.

---

## Etapa 10. Segurança, testes e hospedagem (≈ 2 semanas)

- **Segurança:** CSP via helmet ajustada ao SSR, revisar cabeçalhos, `npm audit`, revisão de todas as rotas (toda rota de escrita com `requireAuth` + `requirePermission`), upload e XSS em campos ricos, limites de payload, troca de senha pelo próprio usuário, expiração e revogação de sessões.
- **Testes:** `vitest` + `supertest` na API (auth, permissões por rota, upload, publish, formulários); smoke test do front (Playwright, opcional). Rodar em CI.
- **Backup:** script `scripts/backup.sh` (`mysqldump` + `tar` de `storage/uploads`, retenção configurável) e exemplo de cron; documentar restauração.
- **LGPD:** política de retenção/exclusão de `form_submissions`, texto-base de política de privacidade (modelo), registro de consentimento.
- **Operação:** `ecosystem.config.cjs` (PM2), exemplo de Nginx com HTTPS, healthcheck, logs estruturados (`pino`).
- **Duplicação limpa:** script `npm run verify:clean` que falha se houver `.env`, uploads ou credenciais no repositório; checklist de entrega ao cliente.

**Aceite:** suíte verde; backup e restauração testados em banco vazio; checklist de go-live concluído; `verify:clean` passa no template.

**Prompt**
> Implemente a Etapa 10 conforme docs/ROADMAP.md. Comece por uma auditoria: liste toda rota de escrita e confirme auth, permissão e validação; reporte as lacunas antes de corrigir.

---

## Riscos que atravessam as etapas
- **Schema das seções muda** com o tempo: sempre incrementar `schemaVersion` e escrever migração de conteúdo.
- **SSR + hidratação** geram diferenças difíceis de depurar: manter componentes públicos puros (sem `window` no render).
- **Concorrência de edição** entre master e cliente: usar `baseVersionId` no autosave.
- **Escopo do editor** cresce fácil: nada de construtor livre na v1.
- **Atualizar instalações antigas:** migrations idempotentes e documentadas.
