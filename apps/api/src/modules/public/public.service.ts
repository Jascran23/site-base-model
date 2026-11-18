import type { RowDataPacket } from 'mysql2';
import { DEFAULT_THEME, themeSchema, type ThemeTokens } from '@cms/shared';
import { pool } from '../../db/pool.js';
import { HttpError } from '../../lib/errors.js';
import { extractMediaIds, pageDraftFromDb } from '../pages/pages.service.js';

export interface PublicSiteData {
  theme: ThemeTokens;
  logoUrl: string | null;
  faviconUrl: string | null;
  business: Record<string, unknown>;
  social: Record<string, unknown>;
  layout: Record<string, unknown>;
  navigation: { title: string; slug: string; isHome: boolean }[];
}
export interface PublicPageData {
  site: PublicSiteData;
  page: { id: number; title: string; slug: string; is_home: number; seo_title: string | null; seo_description: string | null; seo_canonical: string | null; seo_og_image_id: number | null; seo_noindex: number };
  content: ReturnType<typeof pageDraftFromDb>;
  mediaUrls: Record<number,string>;
  mediaMeta: Record<number,{width:number;height:number;thumbUrl:string;alt:string}>;
}

function parseJson(value:unknown):unknown{if(typeof value!=='string')return value;try{return JSON.parse(value);}catch{return null;}}
function objectSetting(value:unknown):Record<string,unknown>{const parsed=parseJson(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};}
async function assetUrl(id:number|null){if(!id)return null;const [rows]=await pool.query<RowDataPacket[]>('SELECT stored_name FROM media WHERE id=?',[id]);return rows[0]?`/uploads/${rows[0].stored_name}`:null;}

export async function getPublicSite():Promise<PublicSiteData>{
  const [[themeRows],[settings],[navigation]]=await Promise.all([
    pool.query<RowDataPacket[]>("SELECT tokens FROM theme_settings WHERE kind='published'"),
    pool.query<RowDataPacket[]>('SELECT `key`,value FROM site_settings WHERE `key` IN (?,?,?)',['business','social','layout']),
    pool.query<RowDataPacket[]>("SELECT title,slug,is_home FROM pages WHERE status='published' ORDER BY is_home DESC,title"),
  ]);
  const parsed=themeRows[0]?themeSchema.safeParse(parseJson(themeRows[0].tokens)):null;
  const theme=parsed?.success?parsed.data:themeSchema.parse(DEFAULT_THEME);
  const settingMap=new Map(settings.map((row)=>[String(row.key),objectSetting(row.value)]));
  const [logoUrl,faviconUrl]=await Promise.all([assetUrl(theme.logoMediaId),assetUrl(theme.faviconMediaId)]);
  return {theme,logoUrl,faviconUrl,business:settingMap.get('business')??{},social:settingMap.get('social')??{},layout:settingMap.get('layout')??{},navigation:navigation.map((row)=>({title:String(row.title),slug:String(row.slug),isHome:Number(row.is_home)===1}))};
}

async function materializePage(row:RowDataPacket,contentValue:unknown,site?:PublicSiteData):Promise<PublicPageData>{
  const content=pageDraftFromDb(contentValue);const publicSite=site??await getPublicSite();
  const ids=[...new Set([...extractMediaIds(content),...(row.seo_og_image_id?[Number(row.seo_og_image_id)]:[]),...(publicSite.theme.logoMediaId?[publicSite.theme.logoMediaId]:[]),...(publicSite.theme.faviconMediaId?[publicSite.theme.faviconMediaId]:[])])];
  const mediaUrls:Record<number,string>={},mediaMeta:PublicPageData['mediaMeta']={};
  if(ids.length){const [media]=await pool.query<RowDataPacket[]>('SELECT id,stored_name,thumb_name,width,height,alt_text FROM media WHERE id IN (?)',[ids]);for(const item of media){const id=Number(item.id);mediaUrls[id]=`/uploads/${item.stored_name}`;mediaMeta[id]={width:Number(item.width),height:Number(item.height),thumbUrl:`/uploads/${item.thumb_name??item.stored_name}`,alt:String(item.alt_text??'')};}}
  return {site:publicSite,page:{id:Number(row.id),title:String(row.title),slug:String(row.slug),is_home:Number(row.is_home),seo_title:row.seo_title?String(row.seo_title):null,seo_description:row.seo_description?String(row.seo_description):null,seo_canonical:row.seo_canonical?String(row.seo_canonical):null,seo_og_image_id:row.seo_og_image_id?Number(row.seo_og_image_id):null,seo_noindex:Number(row.seo_noindex)},content,mediaUrls,mediaMeta};
}

export async function getPublishedPage(slug:string|null):Promise<PublicPageData|null>{
  const condition=slug===null?'p.is_home=1':'p.slug=?';const params=slug===null?[]:[slug];
  const [rows]=await pool.query<RowDataPacket[]>(
    `SELECT p.id,p.title,p.slug,p.is_home,p.seo_title,p.seo_description,p.seo_canonical,p.seo_og_image_id,p.seo_noindex,v.content
       FROM pages p JOIN page_versions v ON v.id=p.published_version_id AND v.page_id=p.id AND v.kind='published'
      WHERE p.status='published' AND ${condition} LIMIT 1`,params);
  return rows[0]?materializePage(rows[0],rows[0].content):null;
}

export async function getPreviewPage(pageId:number,versionId:number):Promise<PublicPageData>{
  const [rows]=await pool.query<RowDataPacket[]>(
    `SELECT p.id,p.title,p.slug,p.is_home,p.seo_title,p.seo_description,p.seo_canonical,p.seo_og_image_id,p.seo_noindex,v.content
       FROM pages p JOIN page_versions v ON v.page_id=p.id
      WHERE p.id=? AND v.id=? AND v.kind='draft'`,[pageId,versionId]);
  if(!rows[0])throw new HttpError(404,'Preview não encontrado.');
  return materializePage(rows[0],rows[0].content);
}

