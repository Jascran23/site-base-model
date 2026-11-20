import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { asyncHandler } from '../../lib/errors.js';
import { requirePermission } from '../../middleware/auth.js';

export const seoRouter=Router();
seoRouter.get('/pages',requirePermission('seo.edit'),asyncHandler(async(_req,res)=>{
  const [rows]=await pool.query<RowDataPacket[]>(`SELECT id,title,slug,status,is_home,seo_title,seo_description,seo_canonical,seo_og_image_id,seo_noindex,updated_at
    FROM pages ORDER BY (seo_title IS NULL OR seo_title='') DESC,(seo_description IS NULL OR seo_description='') DESC,title`);
  res.json({pages:rows.map((row)=>({...row,id:Number(row.id),seo_og_image_id:row.seo_og_image_id?Number(row.seo_og_image_id):null,seo_noindex:Boolean(row.seo_noindex)}))});
}));

export async function sendSitemap(res:import('express').Response){
  const [rows]=await pool.query<RowDataPacket[]>(`SELECT slug,is_home,seo_canonical FROM pages WHERE status='published' AND seo_noindex=0 ORDER BY is_home DESC,title`);
  const base=env.SITE_URL.replace(/\/$/,'');const xmlEscape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const urls=rows.map((row)=>Number(row.is_home)===1?String(row.seo_canonical||base):String(row.seo_canonical||`${base}/${row.slug}`).replace(/\/$/,'')||base);
  const unique=[...new Set(urls)];const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${unique.map((url)=>`<url><loc>${xmlEscape(url)}</loc></url>`).join('')}</urlset>`;
  res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=60');res.send(xml);
}

export function sendRobots(res:import('express').Response){
  const base=env.SITE_URL.replace(/\/$/,'');res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','public, max-age=300');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /preview/\nSitemap: ${base}/sitemap.xml\n`);
}
