import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../lib/api';

export interface MediaItem {
  id: number; original_name: string; stored_name: string; thumb_name: string | null;
  width: number; height: number; alt_text: string | null; category_id: number | null;
  category_name?: string | null; size_bytes: number; created_at: string;
}
interface Category { id: number; name: string; media_count: number }

export function MediaPicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (item: MediaItem) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    Promise.all([
      api<{ items: MediaItem[] }>('/media?limit=60' + (query ? `&q=${encodeURIComponent(query)}` : '') + (category ? `&category_id=${category}` : '')),
      api<{ categories: Category[] }>('/media/categories'),
    ]).then(([media, cats]) => { if (alive) { setItems(media.items); setCategories(cats.categories); setError(''); } })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Não foi possível carregar imagens.'));
    return () => { alive = false; };
  }, [open, query, category]);

  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="panel flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
      <header className="flex items-center justify-between border-b border-ink-100 p-4">
        <h2 id="media-picker-title" className="text-lg font-semibold">Selecionar imagem</h2>
        <button className="btn-ghost !p-2" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      </header>
      <div className="flex gap-2 p-4">
        <label className="relative flex-1"><span className="sr-only">Buscar imagens</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" /><input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar imagens" /></label>
        <select className="input max-w-48" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrar categoria">
          <option value="">Todas as categorias</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="px-4 text-sm text-red-700">{error}</p>}
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => <button key={item.id} className="group overflow-hidden rounded-lg border border-ink-100 text-left hover:border-brand" onClick={() => onSelect(item)}>
          <img src={`/uploads/${item.thumb_name ?? item.stored_name}`} alt="" className="aspect-square w-full bg-ink-50 object-cover" />
          <span className="block truncate p-2 text-xs">{item.alt_text || item.original_name}</span>
        </button>)}
        {!error && !items.length && <p className="col-span-full py-12 text-center text-sm text-ink-500">Nenhuma imagem encontrada.</p>}
      </div>
    </section>
  </div>;
}
