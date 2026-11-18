import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface DashboardData {
  pages: { total: number; published: number; draft: number };
  recentPages: { id: number; title: string; slug: string; status: 'draft' | 'published'; updated_at: string }[];
  activity: { id: number; action: string; user_name: string | null; created_at: string }[];
}

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function Dashboard() {
  const { user, can } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { api<DashboardData>('/dashboard').then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <p role="alert" className="text-red-700">{error}</p>;
  if (!data) return <p className="text-ink-500">Carregando…</p>;

  const stats = [
    { label: 'Páginas', value: data.pages.total },
    { label: 'Publicadas', value: data.pages.published },
    { label: 'Rascunhos', value: data.pages.draft },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Olá, {user?.name.split(' ')[0]}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="panel p-4">
            <p className="text-3xl font-semibold">{s.value}</p>
            <p className="text-sm text-ink-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {can('pages.view') && <Link className="btn-primary" to="/admin/paginas">Editar páginas</Link>}
        {(can('media.view') || can('media.select')) && <Link className="btn-ghost" to="/admin/imagens">Biblioteca de imagens</Link>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-3 font-medium">Últimas alterações</h2>
          {data.recentPages.length === 0
            ? <p className="text-sm text-ink-500">Nenhuma página criada ainda.</p>
            : <ul className="divide-y divide-ink-100">{data.recentPages.map((p) => (
                <li key={p.id} className="flex justify-between py-2 text-sm">
                  <span>{p.title} <span className="text-ink-500">/{p.slug}</span></span>
                  <span className="text-ink-500">{p.status === 'published' ? 'Publicada' : 'Rascunho'} · {fmt(p.updated_at)}</span>
                </li>))}</ul>}
        </section>
        {can('audit.view') && (
          <section className="panel p-4">
            <h2 className="mb-3 font-medium">Atividades recentes</h2>
            <ul className="divide-y divide-ink-100">{data.activity.map((a) => (
              <li key={a.id} className="flex justify-between py-2 text-sm">
                <span>{a.user_name ?? 'Sistema'} · {a.action}</span><span className="text-ink-500">{fmt(a.created_at)}</span>
              </li>))}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
