import { useEffect, type CSSProperties } from 'react';
import { themeToCssVars, type PageDraft, type PageSummary, type ThemeTokens } from '@cms/shared';
import { SectionRenderer, type PublicMediaMeta } from './sections';

export interface PublicPageData {
  site:{theme:ThemeTokens;logoUrl:string|null;faviconUrl:string|null;business:Record<string,unknown>;social:Record<string,unknown>;layout:Record<string,unknown>;navigation:{title:string;slug:string;isHome:boolean}[]};
  page:Pick<PageSummary,'id'|'title'|'slug'|'is_home'|'seo_title'|'seo_description'|'seo_canonical'|'seo_og_image_id'|'seo_noindex'>;
  content:PageDraft;mediaUrls:Record<number,string>;mediaMeta:Record<number,PublicMediaMeta>;
}

export function PublicPage({data}:{data:PublicPageData}){
  const {site,page,content}=data;const theme=site.theme;
  useEffect(()=>{
    document.title=page.seo_title||page.title;
    const description=document.querySelector<HTMLMetaElement>('meta[name="description"]');if(description&&page.seo_description)description.content=page.seo_description;
    if(site.faviconUrl){let favicon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.append(favicon);}favicon.href=site.faviconUrl;}
  },[page,site.faviconUrl]);
  const vars=themeToCssVars(theme) as CSSProperties;const businessName=typeof site.business.name==='string'&&site.business.name?site.business.name:page.title;
  return <div className="min-h-screen" style={{...vars,backgroundColor:theme.colors.background,color:theme.colors.text,fontFamily:theme.typography.bodyFont,fontSize:theme.typography.baseSize}}>
    <header className="border-b" style={{borderColor:theme.colors.surface,backgroundColor:theme.colors.background}}><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">{site.logoUrl?<a href="/" aria-label={`${businessName}, início`}><img src={site.logoUrl} alt={businessName} className="max-h-16 max-w-52 object-contain"/></a>:<a href="/" className="text-lg font-semibold" style={{fontFamily:theme.typography.headingFont,color:theme.colors.primary}}>{businessName}</a>}<nav aria-label="Navegação principal" className="flex flex-wrap gap-4 text-sm">{site.navigation.map((item)=><a key={item.slug} href={item.isHome?'/':`/${item.slug}`} aria-current={item.slug===page.slug?'page':undefined} className="hover:underline">{item.title}</a>)}</nav></div></header>
    <main className="mx-auto max-w-6xl">{!content.sections.some((section)=>section.type==='hero'&&!section.hidden)&&<h1 className="sr-only">{page.title}</h1>}{content.sections.length?content.sections.map((section)=><SectionRenderer key={section.id} section={section} mediaUrls={data.mediaUrls} mediaMeta={data.mediaMeta}/>):<section className="px-6 py-16"><h2 className="text-3xl font-semibold" style={{fontFamily:theme.typography.headingFont,color:theme.colors.primary}}>{page.title}</h2></section>}</main>
    <footer className="mt-12" style={{backgroundColor:theme.colors.surface,color:theme.colors.textMuted}}><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-6 py-8 text-sm"><span>{businessName}</span><span>{typeof site.business.email==='string'?site.business.email:''}</span><span>{typeof site.business.phone==='string'?site.business.phone:''}</span></div></footer>
  </div>;
}

export function PublicNotFound(){return <main className="mx-auto max-w-2xl p-8"><h1 className="text-3xl font-semibold">Página não encontrada</h1><p className="mt-3 text-ink-500">O endereço solicitado não corresponde a uma página publicada.</p><a href="/" className="btn-primary mt-6">Voltar ao início</a></main>;}
