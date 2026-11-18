// Catálogo único de permissões. Para criar uma nova, basta adicionar aqui e rodar `npm run seed`.
export interface PermissionDef { key: string; label: string; group: string; masterOnly?: boolean }

export const PERMISSIONS: PermissionDef[] = [
  { key: 'pages.view', label: 'Ver páginas', group: 'Páginas' },
  { key: 'pages.create', label: 'Criar páginas', group: 'Páginas' },
  { key: 'pages.edit', label: 'Editar páginas e textos', group: 'Páginas' },
  { key: 'pages.delete', label: 'Excluir páginas', group: 'Páginas' },
  { key: 'pages.publish', label: 'Publicar e despublicar', group: 'Páginas' },
  { key: 'sections.manage', label: 'Adicionar, remover e reordenar seções', group: 'Páginas' },
  { key: 'media.view', label: 'Ver biblioteca de imagens', group: 'Imagens' },
  { key: 'media.select', label: 'Selecionar e substituir imagens', group: 'Imagens' },
  { key: 'media.upload', label: 'Enviar imagens', group: 'Imagens' },
  { key: 'media.delete', label: 'Excluir imagens', group: 'Imagens' },
  { key: 'theme.edit', label: 'Alterar aparência (cores e fontes)', group: 'Aparência' },
  { key: 'seo.edit', label: 'Editar SEO', group: 'SEO' },
  { key: 'settings.business', label: 'Atualizar informações comerciais', group: 'Configurações' },
  { key: 'forms.view', label: 'Ver mensagens recebidas', group: 'Formulários' },
  // Somente o desenvolvedor master (não podem ser concedidas):
  { key: 'users.manage', label: 'Gerenciar usuários e permissões', group: 'Sistema', masterOnly: true },
  { key: 'templates.manage', label: 'Gerenciar modelos', group: 'Sistema', masterOnly: true },
  { key: 'settings.technical', label: 'Parâmetros técnicos', group: 'Sistema', masterOnly: true },
  { key: 'audit.view', label: 'Ver histórico de alterações', group: 'Sistema', masterOnly: true },
];

export const GRANTABLE_KEYS = PERMISSIONS.filter((p) => !p.masterOnly).map((p) => p.key);
export const MASTER_ONLY_KEYS = PERMISSIONS.filter((p) => p.masterOnly).map((p) => p.key);
