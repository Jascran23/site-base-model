import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, Image as ImageIcon, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { type PageDraft, type PageSummary } from '@cms/shared';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { MediaPicker, type MediaItem } from '../MediaPicker';
import { SectionEditor } from './SectionEditor';

interface PageEditorData {
  page: PageSummary;
  draft: { id: number; content: PageDraft; created_at: string };
}

export function PageSettings() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const canEdit = can('pages.edit');
  const canSeo = can('seo.edit');
  const canSelectMedia = can('media.select');
  const canPickMedia = can('media.select') || can('media.view');
  const [page, setPage] = useState<PageSummary | null>(null);
  const [draft, setDraft] = useState<PageEditorData['draft'] | null>(null);
  const [title, setTitle] = useState(''); const [slug, setSlug] = useState('');
  const [seoTitle, setSeoTitle] = useState(''); const [seoDescription, setSeoDescription] = useState('');
  const [canonical, setCanonical] = useState(''); const [noindex, setNoindex] = useState(false);
  const [ogImage, setOgImage] = useState<MediaItem | null>(null); const [ogImageId, setOgImageId] = useState<number | null>(null); const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id < 1) { setError('Identificador de página inválido.'); setLoading(false); return; }
    setLoading(true);
    try {
      const result = await api<PageEditorData>(`/pages/${id}/draft`);
      setPage(result.page); setDraft(result.draft);
      setTitle(result.page.title); setSlug(result.page.slug);
      setSeoTitle(result.page.seo_title ?? ''); setSeoDescription(result.page.seo_description ?? '');
      setCanonical(result.page.seo_canonical ?? ''); setNoindex(!!result.page.seo_noindex);
      setOgImageId(result.page.seo_og_image_id);
      setOgImage(null);
      if (result.page.seo_og_image_id && canPickMedia) {
        try { setOgImage((await api<{ item: MediaItem }>(`/media/${result.page.seo_og_image_id}`)).item); }
        catch { /* O acesso à mídia pode ser revogado independentemente da permissão de SEO. */ }
      }
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar a página.'); }
    finally { setLoading(false); }
  }, [id, canPickMedia]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    const body: Record<string, unknown> = {};
    if (canEdit) { body.title = title; body.slug = slug; }
    if (canSeo) {
      body.seo_title = seoTitle || null;
      body.seo_description = seoDescription || null;
      body.seo_canonical = canonical || null;
      body.seo_og_image_id = ogImageId;
      body.seo_noindex = noindex;
    }
    try {
      await api(`/pages/${id}`, { method: 'PATCH', body });
      setNotice('Configurações salvas.'); await load();
    } catch (e) {
      setError(e instanceof ApiError && e.fields?.length ? e.fields.map((field) => field.message).join(' ') : e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally { setSaving(false); }
  }

  async function perform(action: string, message: string) {
    setError(''); setNotice('');
    try { await api(`/pages/${id}/${action}`, { method: 'POST' }); setNotice(message); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir a ação.'); }
  }

  async function preview() {
    try {
      const result = await api<{ token: string }>(`/pages/${id}/preview-token`, { method: 'POST' });
      navigate(`/admin/preview/${result.token}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar o preview.'); }
  }

  async function saveAsTemplate() {
    const name=window.prompt('Nome do modelo',page?.title??'');if(!name?.trim())return;
    const segment=window.prompt('Segmento: advocacia, saude, institucional ou custom','custom');if(!segment)return;
    try { await api(`/templates/from-page/${id}`,{method:'POST',body:{name,segment}});setNotice('Página salva como modelo.'); }
    catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar o modelo.');}
  }

  if (loading) return <p className="text-sm text-ink-500">Carregando página…</p>;
  if (!page || !draft) return <div className="space-y-4"><button className="btn-ghost" onClick={() => navigate('/admin/paginas')}><ArrowLeft size={16} /> Voltar às páginas</button>{error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}</div>;

  return <div className="mx-auto max-w-4xl space-y-5">
    <button className="btn-ghost" onClick={() => navigate('/admin/paginas')}><ArrowLeft size={16} /> Páginas</button>
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm text-ink-500">Configurações da página</p><h1 className="text-2xl font-semibold">{page.title}</h1><p className="mt-1 text-sm text-ink-500">/{page.slug} · {page.status === 'published' ? 'Publicada' : 'Rascunho'}</p></div>
      <div className="flex flex-wrap gap-2">
        {can('pages.view') && <button className="btn-ghost" onClick={() => void preview()}><Eye size={16} /> Visualizar rascunho</button>}
        {can('templates.manage') && <button className="btn-ghost" onClick={() => void saveAsTemplate()}>Salvar como modelo</button>}
        {can('pages.publish') && page.status === 'draft' && <button className="btn-primary" onClick={() => void perform('publish', 'Página publicada.')}>Publicar</button>}
        {can('pages.publish') && page.status === 'published' && <button className="btn-ghost" onClick={() => void perform('unpublish', 'Página voltou para rascunho.')}>Despublicar</button>}
        {can('pages.publish') && page.status === 'published' && !page.is_home && <button className="btn-ghost" onClick={() => void perform('set-home', 'Página definida como inicial.')}>Definir como inicial</button>}
      </div>
    </header>

    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-md bg-brand-soft p-3 text-sm text-brand-dark">{notice}</p>}

    <form onSubmit={save} className="space-y-5">
      {(canEdit || canSeo) && <section className="panel space-y-4 p-5">
        <div><h2 className="font-semibold">Informações</h2><p className="mt-1 text-sm text-ink-500">Título e endereço da página.</p></div>
        <label className="block"><span className="label">Título</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={190} disabled={!canEdit} /></label>
        <label className="block"><span className="label">Slug</span><div className="flex items-center gap-2"><span className="text-sm text-ink-500">/</span><input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={190} disabled={!canEdit} /></div><span className="mt-1 block text-xs text-ink-500">Minúsculo, sem acentos. Slug reservado não pode ser usado.</span></label>
      </section>}

      <section className="panel space-y-4 p-5">
        <div><h2 className="font-semibold">SEO</h2><p className="mt-1 text-sm text-ink-500">Metadados associados a esta página.</p></div>
        <label className="block"><span className="label">Título SEO</span><input className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={190} disabled={!canSeo} /></label>
        <label className="block"><span className="label">Descrição</span><textarea className="input min-h-24" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={320} disabled={!canSeo} /></label>
        <label className="block"><span className="label">URL canônica</span><input className="input" type="url" value={canonical} onChange={(e) => setCanonical(e.target.value)} maxLength={255} placeholder="https://exemplo.com/pagina" disabled={!canSeo} /></label>
        <div>
          <span className="label">Imagem de compartilhamento</span>
          {ogImage ? <div className="flex items-center gap-3 rounded-md border border-ink-100 p-2"><img src={`/uploads/${ogImage.thumb_name ?? ogImage.stored_name}`} alt="" className="h-14 w-14 rounded object-cover" /><span className="min-w-0 flex-1 truncate text-sm">{ogImage.alt_text || ogImage.original_name}</span>{canSeo && <button type="button" className="rounded p-2 text-ink-500 hover:bg-ink-50" aria-label="Remover imagem" onClick={() => { setOgImage(null); setOgImageId(null); }}><X size={16} /></button>}</div>
            : <p className="rounded-md border border-dashed border-ink-300 p-3 text-sm text-ink-500">{ogImageId ? `Imagem vinculada (ID ${ogImageId}).` : 'Nenhuma imagem selecionada.'}</p>}
          {canSeo && canSelectMedia && <div className="mt-2 flex gap-2"><button type="button" className="btn-ghost" onClick={() => setPickerOpen(true)}><ImageIcon size={16} /> Selecionar imagem</button>{ogImageId && <button type="button" className="btn-ghost" onClick={() => { setOgImage(null); setOgImageId(null); }}>Remover imagem</button>}</div>}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} disabled={!canSeo} /> Não indexar esta página</label>
      </section>

      {canEdit ? <SectionEditor key={`${page.id}-${draft.id}`} initial={draft.content} versionId={draft.id} pageId={page.id} canStructure={user?.role === 'master'} /> : <section className="panel p-5"><h2 className="font-semibold">Conteúdo</h2><p className="mt-1 text-sm text-ink-500">Rascunho v{draft.id} com {draft.content.sections.length} seções. Você não tem permissão para editá-lo.</p></section>}

      {(canEdit || canSeo) && <div className="flex justify-end"><button className="btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar configurações'}</button></div>}
    </form>
    <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(item) => { setOgImage(item); setOgImageId(item.id); setPickerOpen(false); }} />
  </div>;
}
