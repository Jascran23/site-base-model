import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { FolderPlus, ImagePlus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { api, apiUpload } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { MediaPicker, type MediaItem } from '../MediaPicker';

interface Category { id: number; name: string; media_count: number }
interface Usage { entity_type: string; entity_id: number; context: string | null; page_title: string | null; page_slug: string | null }
interface Listing { items: MediaItem[]; pagination: { page: number; pages: number; total: number } }

const url = (name: string | null) => name ? `/uploads/${name}` : '';
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function Media() {
  const { can } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null); const [usages, setUsages] = useState<Usage[]>([]);
  const [query, setQuery] = useState(''); const [categoryId, setCategoryId] = useState(''); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [total, setTotal] = useState(0);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [dragging, setDragging] = useState(false);
  const [newCategory, setNewCategory] = useState(''); const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canUpload = can('media.upload'); const canDelete = can('media.delete'); const canEdit = can('media.upload');

  const load = useCallback(async () => {
    try {
      const suffix = new URLSearchParams({ page: String(page), limit: '24', ...(query ? { q: query } : {}), ...(categoryId ? { category_id: categoryId } : {}) });
      const [result, categoryResult] = await Promise.all([
        api<Listing>(`/media?${suffix}`), api<{ categories: Category[] }>('/media/categories'),
      ]);
      setItems(result.items); setPages(Math.max(1, result.pagination.pages)); setTotal(result.pagination.total); setCategories(categoryResult.categories); setError('');
      setSelected((current) => current ? result.items.find((item) => item.id === current.id) ?? current : null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar a biblioteca.'); }
  }, [page, query, categoryId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 180); return () => window.clearTimeout(timer); }, [load]);

  const selectItem = async (item: MediaItem) => {
    setSelected(item); setUsages([]);
    if (can('media.view')) {
      try { setUsages((await api<{ usages: Usage[] }>(`/media/${item.id}/usages`)).usages); }
      catch { setUsages([]); }
    }
  };

  async function uploadFile(file?: File) {
    if (!file || !canUpload) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const form = new FormData(); form.append('file', file);
      const result = await apiUpload<{ id: number }>('/media', form);
      setPage(1); setNotice('Imagem enviada e otimizada.');
      const suffix = new URLSearchParams({ page: '1', limit: '24', ...(query ? { q: query } : {}), ...(categoryId ? { category_id: categoryId } : {}) });
      const listing = await api<Listing>(`/media?${suffix}`); setItems(listing.items); setPages(Math.max(1, listing.pagination.pages)); setTotal(listing.pagination.total);
      const uploaded = listing.items.find((item) => item.id === result.id); if (uploaded) void selectItem(uploaded);
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao enviar imagem.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); void uploadFile(event.dataTransfer.files[0]); }
  function onFile(event: ChangeEvent<HTMLInputElement>) { void uploadFile(event.target.files?.[0]); }

  async function saveMetadata(field: 'alt_text' | 'category_id', rawValue: string) {
    if (!selected || !canEdit) return;
    const value = field === 'category_id' ? (rawValue ? Number(rawValue) : null) : rawValue;
    try {
      await api(`/media/${selected.id}`, { method: 'PATCH', body: { [field]: value } });
      setSelected((item) => item ? { ...item, [field]: value, ...(field === 'category_id' ? { category_name: categories.find((c) => c.id === value)?.name ?? null } : {}) } : item);
      void load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar os detalhes.'); }
  }

  async function replaceFile(file?: File) {
    if (!file || !selected || !canUpload) return;
    setBusy(true); setError('');
    try { const form = new FormData(); form.append('file', file); await apiUpload(`/media/${selected.id}/replace`, form); setNotice('Imagem substituída.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao substituir imagem.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }

  async function deleteItem() {
    if (!selected || !canDelete) return;
    setBusy(true); setError('');
    try { await api(`/media/${selected.id}`, { method: 'DELETE' }); setSelected(null); setNotice('Imagem excluída.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível excluir.'); }
    finally { setBusy(false); }
  }

  async function createCategory(event: FormEvent) {
    event.preventDefault(); setError('');
    try { await api('/media/categories', { method: 'POST', body: { name: newCategory } }); setNewCategory(''); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar categoria.'); }
  }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm text-ink-500">Conteúdo do site</p><h1 className="text-2xl font-semibold">Biblioteca de imagens</h1><p className="mt-1 text-sm text-ink-500">{total} {total === 1 ? 'imagem' : 'imagens'} armazenadas</p></div>
      {canUpload && <><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={onFile} aria-label="Escolher imagem para enviar" /><button className="btn-primary" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={17} /> {busy ? 'Processando…' : 'Enviar imagem'}</button></>}
    </header>

    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-md bg-brand-soft p-3 text-sm text-brand-dark">{notice}</p>}

    {canUpload && <div onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)} onDrop={onDrop}
      className={`rounded-lg border-2 border-dashed p-5 text-center text-sm ${dragging ? 'border-brand bg-brand-soft' : 'border-ink-300 bg-white'}`}>
      <ImagePlus className="mx-auto mb-2 text-ink-500" size={22} /><span>Arraste imagens aqui ou <button className="font-medium text-brand underline" onClick={() => inputRef.current?.click()}>escolha um arquivo</button>. JPEG, PNG, WebP ou GIF.</span>
    </div>}

    <div className="flex flex-wrap gap-2">
      <label className="relative min-w-52 flex-1"><span className="sr-only">Buscar biblioteca</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" /><input className="input pl-9" value={query} onChange={(e) => { setPage(1); setQuery(e.target.value); }} placeholder="Buscar pelo nome ou texto alternativo" /></label>
      <select className="input max-w-56" value={categoryId} onChange={(e) => { setPage(1); setCategoryId(e.target.value); }} aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.media_count})</option>)}</select>
      {canUpload && <form onSubmit={createCategory} className="flex gap-2"><input className="input w-40" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nova categoria" aria-label="Nome da categoria" maxLength={80} required /><button className="btn-ghost" title="Criar categoria"><FolderPlus size={18} /><span className="sr-only">Criar categoria</span></button></form>}
      {can('media.select') && <button className="btn-ghost" onClick={() => setPickerOpen(true)}>Abrir seletor</button>}
    </div>

    <div onClick={() => setSelected(null)} className={`grid gap-4 ${selected ? 'lg:grid-cols-[minmax(0,1fr)_19rem]' : ''}`}>
      <section className="grid content-start grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="Imagens">
        {items.map((item) => <button key={item.id} onClick={(e) => { e.stopPropagation(); void selectItem(item); }} className={`overflow-hidden rounded-lg border bg-white text-left transition hover:border-brand ${selected?.id === item.id ? 'border-brand ring-2 ring-brand/20' : 'border-ink-100'}`}>
          <img src={url(item.thumb_name ?? item.stored_name)} alt="" className="aspect-[4/3] w-full bg-ink-50 object-cover" loading="lazy" />
          <span className="block truncate px-3 pt-2 text-sm font-medium">{item.alt_text || item.original_name}</span><span className="block truncate px-3 pb-3 pt-1 text-xs text-ink-500">{item.category_name || 'Sem categoria'} · {item.width} × {item.height}</span>
        </button>)}
        {!items.length && <div className="panel col-span-full p-10 text-center text-sm text-ink-500">Nenhuma imagem encontrada.</div>}
      </section>

      {selected && <aside onClick={(e) => e.stopPropagation()} className="panel h-fit overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 p-3"><h2 className="font-semibold">Detalhes</h2><button className="rounded p-1 text-ink-500 hover:bg-ink-50" aria-label="Fechar detalhes" onClick={() => setSelected(null)}><X size={18} /></button></div>
        <img src={url(selected.stored_name)} alt={selected.alt_text || ''} className="max-h-56 w-full bg-ink-50 object-contain" />
        <div className="space-y-4 p-4 text-sm">
          <div><p className="break-all font-medium">{selected.original_name}</p><p className="mt-1 text-xs text-ink-500">{selected.width} × {selected.height} · {formatBytes(selected.size_bytes)}</p></div>
          <label className="block"><span className="label">Texto alternativo</span><input className="input" defaultValue={selected.alt_text ?? ''} maxLength={255} disabled={!canEdit} onBlur={(e) => { if (e.target.value !== (selected.alt_text ?? '')) void saveMetadata('alt_text', e.target.value); }} /></label>
          <label className="block"><span className="label">Categoria</span><select className="input" value={selected.category_id ?? ''} disabled={!canEdit} onChange={(e) => void saveMetadata('category_id', e.target.value)}><option value="">Sem categoria</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <div><h3 className="label">Usada em ({usages.length})</h3>{usages.length ? <ul className="space-y-1 text-xs text-ink-600">{usages.map((u, i) => <li key={`${u.entity_type}-${u.entity_id}-${i}`}>{u.page_title ? `${u.page_title} (${u.page_slug})` : `${u.entity_type} #${u.entity_id}`}{u.context ? ` · ${u.context}` : ''}</li>)}</ul> : <p className="text-xs text-ink-500">Ainda não está sendo usada.</p>}</div>
          <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-3">
            {canUpload && <label className="btn-ghost cursor-pointer"><RefreshCw size={15} /> Substituir<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={busy} onChange={(e) => void replaceFile(e.target.files?.[0])} /></label>}
            {canDelete && <button className="btn-ghost text-red-700" disabled={busy || usages.length > 0} onClick={() => void deleteItem()} title={usages.length ? 'Remova os usos antes de excluir' : undefined}><Trash2 size={15} /> Excluir</button>}
          </div>
        </div>
      </aside>}
    </div>

    <div className="flex items-center justify-center gap-3 text-sm"><button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button><span>Página {page} de {pages}</span><button className="btn-ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</button></div>
    <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(item) => { setPickerOpen(false); void selectItem(item); }} />
  </div>;
}
