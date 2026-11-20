import { Router } from 'express';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool.js';
import { asyncHandler } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { requireMaster, requirePermission } from '../../middleware/auth.js';
import { env } from '../../config/env.js';

export const settingsRouter=Router();
const businessSchema=z.object({
  name:z.string().trim().max(190),segment:z.enum(['institutional','legal','medical','physician']),
  email:z.union([z.literal(''),z.string().email().max(190)]),phone:z.string().trim().max(40),whatsapp:z.string().trim().max(30),
  address:z.string().trim().max(320),hours:z.string().trim().max(320),
}).strict();
const socialLink=z.union([z.literal(''),z.string().url().max(255).refine((value)=>/^https?:\/\//i.test(value),'Use uma URL http(s).')]);
const socialSchema=z.object({instagram:socialLink,facebook:socialLink,linkedin:socialLink}).strict();
const technicalSchema=z.object({submissionRetentionDays:z.number().int().min(30).max(3650)}).strict();
function jsonValue(value:unknown){if(typeof value!=='string')return value;try{return JSON.parse(value);}catch{return null;}}
function settingSchema(key:string){return key==='business'?businessSchema:key==='social'?socialSchema:technicalSchema;}
function defaults(key:string){return key==='business'?{name:'',segment:'institutional',email:'',phone:'',whatsapp:'',address:'',hours:''}:key==='social'?{instagram:'',facebook:'',linkedin:''}:{submissionRetentionDays:365};}
async function getSetting(key:string){const [rows]=await pool.query<RowDataPacket[]>('SELECT value FROM site_settings WHERE `key`=?',[key]);if(!rows[0])return defaults(key);const stored=jsonValue(rows[0].value);const merged=stored&&typeof stored==='object'&&!Array.isArray(stored)?{...defaults(key),...stored}:defaults(key);const parsed=settingSchema(key).safeParse(merged);return parsed.success?parsed.data:defaults(key);}

settingsRouter.get('/business',requirePermission('settings.business'),asyncHandler(async(_req,res)=>{
  const [business,social]=await Promise.all([getSetting('business'),getSetting('social')]);res.json({business,social});
}));
settingsRouter.put('/business',requirePermission('settings.business'),asyncHandler(async(req,res)=>{
  const data=z.object({business:businessSchema,social:socialSchema}).strict().parse(req.body);
  for(const [key,value] of Object.entries(data))await pool.query('INSERT INTO site_settings (`key`,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',[key,JSON.stringify(value)]);
  await audit(req,'settings.business.update','site_setting','business',{segment:data.business.segment});res.json({ok:true});
}));

settingsRouter.get('/technical',requirePermission('settings.technical'),requireMaster,asyncHandler(async(_req,res)=>{
  const [technical]=await Promise.all([getSetting('technical')]);
  res.json({technical,siteUrl:env.SITE_URL});
}));
settingsRouter.put('/technical',requirePermission('settings.technical'),requireMaster,asyncHandler(async(req,res)=>{
  const technical=technicalSchema.parse(req.body);await pool.query('INSERT INTO site_settings (`key`,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',['technical',JSON.stringify(technical)]);
  await audit(req,'settings.technical.update','site_setting','technical',technical);res.json({ok:true});
}));

