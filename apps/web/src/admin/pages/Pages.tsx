import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, Eye, FilePlus2, Globe, House, Pencil, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { type PageSummary } from '@cms/shared';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface PageList { pages: PageSummary[]; pagination: { page: number; pages: number; total: number } }

export function Pages() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [status, setStatus] = useState<'all' | 'draft' | 'published'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagesCount, setPagesCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status, page: String(page), limit: '24', ...(query ? { q: query } : {}) });
      const result = await api<PageList>(`/pages?${params}`);
      setPages(result.pages); setPagesCount(Math.max(1, result.pagination.pages)); setTotal(result.pagination.total); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar as páginas.'); }
  }, [status, query, page]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 160); return () => window.clearTimeout(timer); }, [load]);

  async function act(action: () => Promise<unknown>, success: string) {
    setError(''); setNotice('');
    try { await action(); setNotice(success); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir a ação.'); }
  }

  async function preview(id: number) {
    try {
      const result = await api<{ token: string }>(`/pages/${id}/preview-token`, { method: 'POST' });
      navigate(`/admin/preview/${result.token}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o preview.'); }
  }

  async function duplicate(id: number) {
    const result = await api<{ id: number }>('/pages/' + id + '/duplicate', { method: 'POST' });
    navigate(`/admin/paginas/${result.id}`);
  }

  async function remove(item: PageSummary) {
    if (!window.confirm(`Excluir a página “${item.title}”? Esta ação também remove os usos de mídia associados.`)) return;
    await act(() => api(`/pages/${item.id}`, { method: 'DELETE' }), 'Página excluída.');
  }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm text-ink-500">Conteúdo do site</p><h1 className="text-2xl font-semibold">Páginas</h1><p className="mt-1 text-sm text-ink-500">{total} {total === 1 ? 'página cadastrada' : 'páginas cadastradas'}</p></div>
      {can('pages.create') && <button className="btn-primary" onClick={() => setCreateOpen(true)}><FilePlus2 size={17} /> Nova página</button>}
    </header>

    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-md bg-brand-soft p-3 text-sm text-brand-dark">{notice}</p>}

    <div className="flex flex-wrap gap-2">
      <label className="relative min-w-52 flex-1"><span className="sr-only">Buscar páginas</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" /><input className="input pl-9" value={query} onChange={(e) => { setPage(1); setQuery(e.target.value); }} placeholder="Buscar por título ou slug" /></label>
      <select className="input max-w-48" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as typeof status); }} aria-label="Filtrar por status">
        <option value="all">Todos os status</option><option value="draft">Rascunhos</option><option value="published">Publicadas</option>
      </select>
    </div>

    <section className="space-y-3" aria-label="Lista de páginas">
      {pages.map((item) => <article key={item.id} className="panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold">{item.title}</h2>
            {item.is_home ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-dark"><House size={12} /> Inicial</span> : null}
            <span className={`rounded-full px-2 py-0.5 text-xs ${item.status === 'published' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>{item.status === 'published' ? 'Publicada' : 'Rascunho'}</span>
          </div>
          <p className="mt-1 truncate text-sm text-ink-500">/{item.slug} · Atualizada em {new Date(item.updated_at).toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(can('pages.edit') || can('seo.edit')) && <button className="btn-ghost !px-3" onClick={() => navigate(`/admin/paginas/${item.id}`)} title="Configurações"><Pencil size={16} /><span className="sr-only">Configurações de {item.title}</span></button>}
          {can('pages.view') && <button className="btn-ghost !px-3" onClick={() => void preview(item.id)} title="Visualizar rascunho"><Eye size={16} /><span className="sr-only">Visualizar {item.title}</span></button>}
          {can('pages.create') && <button className="btn-ghost !px-3" onClick={() => void act(() => duplicate(item.id), 'Página duplicada.')} title="Duplicar"><Copy size={16} /><span className="sr-only">Duplicar {item.title}</span></button>}
          {can('pages.publish') && item.status === 'draft' && <button className="btn-ghost !px-3" onClick={() => void act(() => api(`/pages/${item.id}/publish`, { method: 'POST' }), 'Página publicada.')} title="Publicar"><Globe size={16} /><span className="sr-only">Publicar {item.title}</span></button>}
          {can('pages.publish') && item.status === 'published' && <button className="btn-ghost !px-3" onClick={() => void act(() => api(`/pages/${item.id}/unpublish`, { method: 'POST' }), 'Página voltou para rascunho.')} title="Despublicar"><Globe size={16} className="opacity-50" /><span className="sr-only">Despublicar {item.title}</span></button>}
          {can('pages.publish') && item.status === 'published' && !item.is_home && <button className="btn-ghost !px-3" onClick={() => void act(() => api(`/pages/${item.id}/set-home`, { method: 'POST' }), 'Página definida como inicial.')} title="Definir como página inicial"><House size={16} /><span className="sr-only">Definir {item.title} como inicial</span></button>}
          {can('pages.delete') && <button className="btn-ghost !px-3 text-red-700" onClick={() => void remove(item)} title="Excluir"><Trash2 size={16} /><span className="sr-only">Excluir {item.title}</span></button>}
        </div>
      </article>)}
      {!pages.length && <div className="panel p-10 text-center text-sm text-ink-500">Nenhuma página encontrada. Crie uma página em branco para começar.</div>}
    </section>

    <div className="flex items-center justify-center gap-3 text-sm"><button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página {page} de {pagesCount}</span><button className="btn-ghost" disabled={page >= pagesCount} onClick={() => setPage((value) => value + 1)}>Próxima</button></div>

    {createOpen && <CreatePage onClose={() => setCreateOpen(false)} onCreated={(id) => navigate(`/admin/paginas/${id}`)} />}
  </div>;
}

function CreatePage({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [templateId,setTemplateId]=useState('');const [templates,setTemplates]=useState<{id:number;name:string;segment:string}[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(()=>{void api<{templates:{id:number;name:string;segment:string}[]}>('/templates/available').then((x)=>setTemplates(x.templates)).catch(()=>{});},[]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api<{ id: number }>('/pages', { method: 'POST', body: { title, ...(slug.trim() ? { slug } : {}), ...(templateId?{template_id:Number(templateId)}:{}) } });
      onCreated(result.id);
    } catch (e) {
      setError(e instanceof ApiError && e.fields?.length ? e.fields.map((field) => field.message).join(' ') : e instanceof Error ? e.message : 'Não foi possível criar a página.');
    } finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4">
    <form onSubmit={submit} className="panel my-8 w-full max-w-lg space-y-4 p-6">
      <div><h2 className="text-lg font-semibold">Criar página</h2><p className="mt-1 text-sm text-ink-500">A página começa como rascunho e pode partir de um modelo.</p></div>
      <label className="block"><span className="label">Título</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} minLength={2} maxLength={190} required autoFocus /></label>
      <label className="block"><span className="label">Slug (opcional)</span><input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={190} placeholder="gerado a partir do título" /><span className="mt-1 block text-xs text-ink-500">Será convertido para minúsculas e sem acentos.</span></label>
      <label className="block"><span className="label">Modelo</span><select className="input" value={templateId} onChange={(e)=>setTemplateId(e.target.value)}><option value="">Página em branco</option>{templates.map((x)=><option key={x.id} value={x.id}>{x.name} · {x.segment}</option>)}</select></label>
      {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy}>{busy ? 'Criando…' : 'Criar rascunho'}</button></div>
    </form>
  </div>;
}
