import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

type SeoPage={id:number;title:string;slug:string;status:'draft'|'published';is_home:number;seo_title:string|null;seo_description:string|null;seo_canonical:string|null;seo_og_image_id:number|null;seo_noindex:boolean};
export function Seo(){
 const [pages,setPages]=useState<SeoPage[]>([]);const [error,setError]=useState('');
 const load=useCallback(async()=>{try{const result=await api<{pages:SeoPage[]}>('/seo/pages');setPages(result.pages);setError('');}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os dados de SEO.');}},[]);
 useEffect(()=>{void load();},[load]);
 const needs=(page:SeoPage)=>!page.seo_title||!page.seo_description;
 return <div className="space-y-5"><header><p className="text-sm text-ink-500">Indexação e compartilhamento</p><h1 className="text-2xl font-semibold">SEO</h1><p className="mt-1 text-sm text-ink-500">{pages.filter(needs).length} página(s) precisam de título ou descrição.</p></header>{error&&<p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
 <section className="space-y-3">{pages.map((page)=><article key={page.id} className="panel flex flex-wrap items-center gap-4 p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{page.title}</h2><span className={`rounded-full px-2 py-0.5 text-xs ${page.status==='published'?'bg-green-50 text-green-800':'bg-amber-50 text-amber-800'}`}>{page.status==='published'?'Publicada':'Rascunho'}</span>{page.seo_noindex&&<span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-500">noindex</span>}</div><p className="mt-1 truncate text-xs text-ink-500">/{page.slug}</p><p className="mt-2 text-sm">{page.seo_title||<span className="text-amber-800">Título SEO pendente</span>}</p><p className="truncate text-sm text-ink-500">{page.seo_description||'Descrição pendente'}</p><p className="mt-1 text-xs text-ink-500">{page.seo_canonical||'URL canônica automática'} · {page.seo_og_image_id?'Imagem definida':'Sem imagem OG'}</p></div><div className="flex gap-2"><Link className="btn-ghost !px-3" to={`/admin/paginas/${page.id}`} aria-label={`Editar SEO de ${page.title}`}><Pencil size={16}/></Link>{page.status==='published'&&<a className="btn-ghost !px-3" href={page.is_home?'/':`/${page.slug}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${page.title}`}><ExternalLink size={16}/></a>}</div></article>)}{!pages.length&&<p className="panel p-6 text-sm text-ink-500">Nenhuma página cadastrada.</p>}</section>
 <div className="flex flex-wrap gap-3 text-sm"><a className="btn-ghost" href="/sitemap.xml" target="_blank" rel="noreferrer">Ver sitemap.xml</a><a className="btn-ghost" href="/robots.txt" target="_blank" rel="noreferrer">Ver robots.txt</a></div></div>;
}
