import { Router } from 'express';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { DEFAULT_THEME, THEME_GROUPS, themeClientGroupsSchema, themeSchema, type ThemeClientGroups, type ThemeGroup, type ThemeTokens } from '@cms/shared';
import { pool } from '../../db/pool.js';
import { asyncHandler, HttpError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { requireMaster, requirePermission } from '../../middleware/auth.js';
import { syncMediaUsages } from '../media/media.service.js';

export const themeRouter=Router();
const GROUP_FIELDS:Record<ThemeGroup,(keyof ThemeTokens)[]>={
  colors:['colors'],typography:['typography'],button:['button'],radius:['radius'],shadow:['shadow'],spacing:['spacing'],assets:['logoMediaId','faviconMediaId'],
};
function parseJson(value:unknown):unknown{if(typeof value!=='string')return value;try{return JSON.parse(value);}catch{throw new HttpError(500,'As configurações de tema salvas estão inválidas.','INVALID_THEME');}}
function groupsFromSetting(value:unknown):ThemeClientGroups{const parsed=themeClientGroupsSchema.safeParse(parseJson(value));return parsed.success?[...new Set(parsed.data)]:[];}
async function getGroups(executor:Pool|PoolConnection):Promise<ThemeClientGroups>{const [rows]=await executor.query<RowDataPacket[]>('SELECT value FROM site_settings WHERE `key`=?',['theme_client_groups']);return rows[0]?groupsFromSetting(rows[0].value):[];}
async function ensureThemeRows(executor:Pool|PoolConnection){
  for(const kind of ['draft','published'])await executor.query('INSERT IGNORE INTO theme_settings (kind,tokens) VALUES (?,?)',[kind,JSON.stringify(DEFAULT_THEME)]);
}
async function readTokens(executor:Pool|PoolConnection,kind:'draft'|'published',lock=false):Promise<{id:number;tokens:ThemeTokens}>{
  const [rows]=await executor.query<RowDataPacket[]>(`SELECT id,tokens FROM theme_settings WHERE kind=?${lock?' FOR UPDATE':''}`,[kind]);
  if(!rows[0])throw new HttpError(500,'Configuração de tema não encontrada.');
  const parsed=themeSchema.safeParse(parseJson(rows[0].tokens));if(!parsed.success)throw new HttpError(500,'As configurações de tema salvas estão inválidas.','INVALID_THEME');
  return {id:Number(rows[0].id),tokens:parsed.data};
}
function assertAllowed(current:ThemeTokens,next:ThemeTokens,groups:ThemeClientGroups){
  for(const group of THEME_GROUPS){const fields=GROUP_FIELDS[group];const differs=fields.some((key)=>!isDeepStrictEqual(current[key],next[key]));if(differs&&!groups.includes(group))throw new HttpError(403,`O grupo “${group}” ainda não foi liberado para edição.`, 'FORBIDDEN');}
}
function applyGroups(base:ThemeTokens,source:ThemeTokens,groups:ThemeClientGroups):ThemeTokens{
  const output=structuredClone(base) as ThemeTokens;
  for(const group of groups)for(const key of GROUP_FIELDS[group])Object.assign(output,{[key]:structuredClone(source[key])});
  return themeSchema.parse(output);
}
function mediaIds(tokens:ThemeTokens){return [tokens.logoMediaId,tokens.faviconMediaId].filter((id):id is number=>id!==null);}

themeRouter.get('/draft',requirePermission('theme.edit'),asyncHandler(async(req,res)=>{
  await ensureThemeRows(pool);const draft=await readTokens(pool,'draft');const groups=req.auth!.user.role==='master'?THEME_GROUPS:await getGroups(pool);
  res.json({id:draft.id,tokens:draft.tokens,editableGroups:groups});
}));

themeRouter.get('/public',asyncHandler(async(_req,res)=>{
  const [rows]=await pool.query<RowDataPacket[]>("SELECT tokens FROM theme_settings WHERE kind='published'");
  const tokens=rows[0]?themeSchema.parse(parseJson(rows[0].tokens)):themeSchema.parse(DEFAULT_THEME);
  const assetUrl=async(id:number|null)=>{if(!id)return null;const [media]=await pool.query<RowDataPacket[]>('SELECT stored_name FROM media WHERE id=?',[id]);return media[0]?`/uploads/${media[0].stored_name}`:null;};
  const [logoUrl,faviconUrl]=await Promise.all([assetUrl(tokens.logoMediaId),assetUrl(tokens.faviconMediaId)]);
  res.setHeader('Cache-Control','public, max-age=5, stale-while-revalidate=5');res.json({tokens,logoUrl,faviconUrl});
}));

themeRouter.put('/draft',requirePermission('theme.edit'),asyncHandler(async(req,res)=>{
  const {tokens}=z.object({tokens:themeSchema}).strict().parse(req.body);const conn=await pool.getConnection();let rowId=0;
  let changedGroups:ThemeGroup[]=[];
  try{
    await conn.beginTransaction();await ensureThemeRows(conn);const current=await readTokens(conn,'draft',true);rowId=current.id;
    changedGroups=THEME_GROUPS.filter((group)=>!isDeepStrictEqual(currentGroup(current.tokens,group),currentGroup(tokens,group)));
    if(req.auth!.user.role!=='master'){
      const groups=await getGroups(conn);assertAllowed(current.tokens,tokens,groups);
      const assetsChanged=!isDeepStrictEqual([current.tokens.logoMediaId,current.tokens.faviconMediaId],[tokens.logoMediaId,tokens.faviconMediaId]);
      if(assetsChanged&&!req.auth!.permissions.has('media.select'))throw new HttpError(403,'Você não tem permissão para selecionar imagens.','FORBIDDEN');
    }
    await conn.query('UPDATE theme_settings SET tokens=?,updated_by=? WHERE id=?',[JSON.stringify(tokens),req.auth!.user.id,rowId]);
    await syncMediaUsages('theme',rowId,mediaIds(tokens),conn,'branding');await conn.commit();
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
  await audit(req,'theme.draft.save','theme',rowId,{groups:changedGroups});
  res.json({ok:true,tokens});
}));

function currentGroup(tokens:ThemeTokens,group:ThemeGroup){return GROUP_FIELDS[group].map((key)=>tokens[key]);}

themeRouter.post('/publish',requirePermission('theme.edit'),asyncHandler(async(req,res)=>{
  const conn=await pool.getConnection();let publishedId=0;let published:ThemeTokens;
  try{
    await conn.beginTransaction();await ensureThemeRows(conn);const draft=await readTokens(conn,'draft',true);const current=await readTokens(conn,'published',true);publishedId=current.id;
    if(req.auth!.user.role==='master')published=draft.tokens;
    else {const groups=await getGroups(conn);published=applyGroups(current.tokens,draft.tokens,groups);}
    await conn.query('UPDATE theme_settings SET tokens=?,updated_by=? WHERE id=?',[JSON.stringify(published),req.auth!.user.id,publishedId]);
    await syncMediaUsages('theme',publishedId,mediaIds(published),conn,'branding');await conn.commit();
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
  await audit(req,'theme.publish','theme',publishedId);res.json({ok:true,tokens:published});
}));

themeRouter.post('/reset',requirePermission('theme.edit'),asyncHandler(async(req,res)=>{
  const conn=await pool.getConnection();let rowId=0;let tokens:ThemeTokens;
  try{
    await conn.beginTransaction();await ensureThemeRows(conn);const current=await readTokens(conn,'draft',true);rowId=current.id;
    if(req.auth!.user.role==='master')tokens=themeSchema.parse(DEFAULT_THEME);
    else {const groups=await getGroups(conn);tokens=applyGroups(current.tokens,themeSchema.parse(DEFAULT_THEME),groups);}
    await conn.query('UPDATE theme_settings SET tokens=?,updated_by=? WHERE id=?',[JSON.stringify(tokens),req.auth!.user.id,rowId]);
    await syncMediaUsages('theme',rowId,mediaIds(tokens),conn,'branding');await conn.commit();
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
  await audit(req,'theme.reset','theme',rowId);res.json({ok:true,tokens});
}));

themeRouter.get('/client-groups',requireMaster,asyncHandler(async(_req,res)=>res.json({groups:await getGroups(pool)})));
themeRouter.put('/client-groups',requireMaster,asyncHandler(async(req,res)=>{
  const groups=[...new Set(themeClientGroupsSchema.parse(req.body.groups))];
  await pool.query('INSERT INTO site_settings (`key`,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',['theme_client_groups',JSON.stringify(groups)]);
  await audit(req,'theme.client_groups.update','site_setting',0,{groups});res.json({groups});
}));

