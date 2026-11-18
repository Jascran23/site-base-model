import { useEffect, useState } from 'react';
import { ArrowLeft, Clock3 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { type PageDraft } from '@cms/shared';
import { api } from '../../lib/api';

interface PreviewData {
  page: { id: number; title: string; slug: string; seo_title: string | null; seo_description: string | null; version_id: number };
  content: PageDraft;
  expiresAt: string;
}

export function PagePreview() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<PreviewData>(`/preview/${encodeURIComponent(token)}`)
      .then((result) => { if (active) setData(result); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Preview indisponível.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  return <div className="mx-auto max-w-4xl space-y-5">
    <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</button>
    {loading && <p className="text-sm text-ink-500">Carregando preview…</p>}
    {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {data && <>
      <header className="panel space-y-2 p-6">
        <div className="flex items-center gap-2 text-xs text-ink-500"><span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">Preview de rascunho</span><span>/{data.page.slug}</span></div>
        <h1 className="text-2xl font-semibold">{data.page.title}</h1>
        {data.page.seo_description && <p className="text-sm text-ink-600">{data.page.seo_description}</p>}
        <p className="flex items-center gap-1 pt-2 text-xs text-ink-500"><Clock3 size={13} /> Link expira em {new Date(data.expiresAt).toLocaleTimeString('pt-BR')}.</p>
      </header>
      <section className="panel p-5">
        <h2 className="font-semibold">Conteúdo do rascunho</h2>
        <p className="mt-1 text-sm text-ink-500">O renderer de seções será adicionado na Etapa 8. Por enquanto, confira a estrutura salva.</p>
        <pre className="mt-4 max-h-[60vh] overflow-auto rounded-md bg-ink-900 p-4 text-xs text-ink-50">{JSON.stringify(data.content, null, 2)}</pre>
      </section>
    </>}
  </div>;
}
