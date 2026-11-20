import type { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ThemeTokens } from '@cms/shared';
import { themeToCssVars } from '@cms/shared';
import { env, ROOT_DIR } from './config/env.js';
import { HttpError } from './lib/errors.js';
import { getPreviewPage, getPublishedPage, type PublicPageData } from './modules/public/public.service.js';
import { verifyPreviewToken } from './modules/pages/pages.service.js';

type InitialRender = { kind:'page'; data:PublicPageData } | { kind:'not-found' };
type RenderModule = { render: (url:string,initial:InitialRender)=>string };
const webRoot=path.join(ROOT_DIR,'apps','web');

function escapeHtml(value:string){return value.replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
function safeJson(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
function headMarkup(initial:InitialRender,preview=false){
  if(initial.kind==='not-found')return '<title>Página não encontrada</title><meta name="robots" content="noindex">';
  const {page,site}=initial.data;const title=page.seo_title||page.title;const description=page.seo_description||'';
  const vars=Object.entries(themeToCssVars(site.theme as ThemeTokens)).map(([name,value])=>`${name}:${value}`).join(';');
  const base=env.SITE_URL.replace(/\/$/,'');const canonical=page.seo_canonical||`${base}${page.is_home?'':`/${page.slug}`}`;
  const image=page.seo_og_image_id?initial.data.mediaUrls[page.seo_og_image_id]:null;
  const business=site.business;const segment=business.segment;
  const schemaType=segment==='legal'?'LegalService':segment==='medical'?'MedicalBusiness':segment==='physician'?'Physician':'Organization';
  const structured:Record<string,unknown>={'@context':'https://schema.org','@type':schemaType,name:typeof business.name==='string'&&business.name?business.name:page.title,url:canonical};
  if(typeof business.phone==='string'&&business.phone)structured.telephone=business.phone;
  if(typeof business.email==='string'&&business.email)structured.email=business.email;
  if(typeof business.address==='string'&&business.address)structured.address={'@type':'PostalAddress',streetAddress:business.address};
  const metadata=[`<title>${escapeHtml(title)}</title>`,description?`<meta name="description" content="${escapeHtml(description)}">`:'',page.seo_noindex||preview?'<meta name="robots" content="noindex,nofollow">':'',`<link rel="canonical" href="${escapeHtml(canonical)}">`,`<meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}">`,description?`<meta property="og:description" content="${escapeHtml(description)}">`:'',`<meta property="og:url" content="${escapeHtml(canonical)}">`,image?`<meta property="og:image" content="${escapeHtml(new URL(image,base).toString())}">`:'',`<meta name="twitter:card" content="${image?'summary_large_image':'summary'}">`,site.faviconUrl?`<link rel="icon" href="${escapeHtml(site.faviconUrl)}">`:'',`<script type="application/ld+json">${safeJson(structured)}</script>`,`<style id="site-theme">:root{${vars}}</style>`].filter(Boolean).join('');
  return metadata;
}

export async function installPublicRendering(app:Express){
  let vite:import('vite').ViteDevServer|undefined;let template='';let renderModule:RenderModule|undefined;
  if(env.isProd){
    const dist=path.join(webRoot,'dist');template=await readFile(path.join(dist,'index.html'),'utf8');
    app.use(express.static(dist,{index:false,fallthrough:true,maxAge:'1h'}));
    const ssrFile=path.join(dist,'server','entry-server.js');renderModule=await import(pathToFileURL(ssrFile).href) as RenderModule;
  }else{
    const {createServer}=await import('vite');
    vite=await createServer({root:webRoot,configFile:path.join(webRoot,'vite.config.ts'),server:{middlewareMode:true},appType:'custom'});
    app.use(vite.middlewares);
    template=await readFile(path.join(webRoot,'index.html'),'utf8');
  }
  const sendShell=async(req:Request,res:Response,next:NextFunction)=>{
    try{let html=template;if(vite)html=await vite.transformIndexHtml(req.originalUrl,html);html=html.replace('<!--ssr-head-->','<title>Painel</title>');res.status(200).type('html').send(html);}catch(error){if(vite) vite.ssrFixStacktrace(error as Error);next(error);}
  };
  app.get(['/admin','/admin/*'],sendShell);
  const sendRendered=async(req:Request,res:Response,next:NextFunction,initial:InitialRender,status=200)=>{
    try{
      if(vite)renderModule=await vite.ssrLoadModule('/src/entry-server.tsx') as RenderModule;
      if(!renderModule)throw new Error('Renderizador SSR indisponível.');
      const appHtml=renderModule.render(req.originalUrl,initial);
      let html=template;if(vite)html=await vite.transformIndexHtml(req.originalUrl,html);
      html=html.replace('<!--ssr-head-->',headMarkup(initial,req.path.startsWith('/preview/')));
      html=html.replace('<div id="root"></div>',`<div id="root" data-public="${escapeHtml(safeJson(initial))}">${appHtml}</div>`);
      if(!html.includes('id="root" data-public='))throw new Error('O template HTML não possui o ponto de hidratação esperado.');
      res.status(status).type('html').setHeader('Cache-Control',initial.kind==='page'?'public, max-age=0, must-revalidate':'no-store');res.send(html);
    }catch(error){if(vite) vite.ssrFixStacktrace(error as Error);next(error);}
  };
  app.get('/preview/:token',async(req,res,next)=>{
    try{const token=zToken(req.params.token);const payload=verifyPreviewToken(token);const data=await getPreviewPage(payload.pageId,payload.versionId);await sendRendered(req,res,next,{kind:'page',data},200);}
    catch(error){if(error instanceof HttpError){res.status(error.status).type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Preview indisponível</title><body><main><h1>Preview indisponível</h1><p>${escapeHtml(error.message)}</p></main></body></html>`);return;}next(error);}
  });
  app.get(['/', '/:slug'],async(req,res,next)=>{
    try{
      const slug=req.path==='/'?null:req.params.slug;
      const data=await getPublishedPage(slug??null);
      if(!data){await sendRendered(req,res,next,{kind:'not-found'},404);return;}
      await sendRendered(req,res,next,{kind:'page',data});
    }catch(error){next(error);}
  });
  app.use((req,res,next)=>{
    if(req.method==='GET'&&!req.path.startsWith('/api')&&!req.path.startsWith('/uploads')){next(new HttpError(404,'Página não encontrada.'));return;}
    next();
  });
}

function zToken(value:string){if(value.length<20||value.length>1024)throw new HttpError(404,'Preview não encontrado.');return value;}
