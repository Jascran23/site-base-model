import { createHmac } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { formFieldsSchema } from '@cms/shared';
import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { asyncHandler, HttpError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { requirePermission } from '../../middleware/auth.js';

export const formsAdminRouter=Router();
export const publicFormsRouter=Router();
const idSchema=z.coerce.number().int().positive();
const definitionInput=z.object({name:z.string().trim().min(2).max(120),fields:formFieldsSchema,recipient_email:z.union([z.literal(''),z.string().email().max(190)]).nullable().optional(),success_message:z.string().trim().min(1).max(255).default('Mensagem enviada com sucesso.'),error_message:z.string().trim().min(1).max(255).default('Não foi possível enviar. Tente novamente.')}).strict();
function parseStoredFields(value:unknown){let data=value;if(typeof data==='string'){try{data=JSON.parse(data);}catch{throw new HttpError(500,'A definição deste formulário está inválida.');}}return formFieldsSchema.parse(data);}
function parseStoredJson(value:unknown){if(typeof value!=='string')return value;try{return JSON.parse(value);}catch{return null;}}
function makeSubmissionSchema(fields:z.infer<typeof formFieldsSchema>){
  const shape:Record<string,z.ZodTypeAny>={};
  for(const field of fields){let value=z.string().trim().max(field.maxLength,`O campo ${field.label} ultrapassou o limite.`);if(field.type==='email')value=value.email('Informe um e-mail válido.');if(field.type==='tel')value=value.max(40);shape[field.name]=field.required?value.min(1,`Preencha ${field.label}.`):value.optional().transform((entry)=>entry??'');}
  return z.object(shape).strict();
}
const submitLimiter=rateLimit({windowMs:15*60_000,limit:5,standardHeaders:true,legacyHeaders:false,message:{error:'Muitas tentativas. Aguarde alguns minutos e tente novamente.'}});

publicFormsRouter.get('/:id',asyncHandler(async(req,res)=>{
  const id=idSchema.parse(req.params.id);const [rows]=await pool.query<RowDataPacket[]>('SELECT id,name,fields,success_message FROM form_definitions WHERE id=?',[id]);
  if(!rows[0])throw new HttpError(404,'Formulário não encontrado.');
  res.setHeader('Cache-Control','public, max-age=60');res.json({form:{id:Number(rows[0].id),name:String(rows[0].name),fields:parseStoredFields(rows[0].fields),successMessage:String(rows[0].success_message)}});
}));

publicFormsRouter.post('/:id/submit',submitLimiter,asyncHandler(async(req,res)=>{
  const id=idSchema.parse(req.params.id);const body=z.object({fields:z.record(z.unknown()),consent:z.literal(true),website:z.string().max(500).default('')}).strict().parse(req.body);
  const [rows]=await pool.query<RowDataPacket[]>('SELECT id,fields,success_message,error_message FROM form_definitions WHERE id=?',[id]);
  if(!rows[0])throw new HttpError(404,'Formulário não encontrado.');
  const fields=parseStoredFields(rows[0].fields);const data=makeSubmissionSchema(fields).parse(body.fields);
  if(body.website.trim())return res.status(200).json({ok:true,message:String(rows[0].success_message)});
  const ipHash=createHmac('sha256',env.SESSION_SECRET).update(req.ip||'unknown').digest('hex');
  await pool.query<ResultSetHeader>('INSERT INTO form_submissions (form_id,data,consent_given,ip_hash) VALUES (?,?,1,?)',[id,JSON.stringify(data),ipHash]);
  res.status(201).json({ok:true,message:String(rows[0].success_message)});
}));

formsAdminRouter.get('/inbox',requirePermission('forms.view'),asyncHandler(async(req,res)=>{
  const query=z.object({formId:z.coerce.number().int().positive().optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(30)}).parse(req.query);
  const condition=query.formId?'WHERE s.form_id=?':'';const params=query.formId?[query.formId]:[];
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM form_submissions s ${condition}`,params);
  const [rows]=await pool.query<RowDataPacket[]>(`SELECT s.id,s.form_id,s.data,s.consent_given,s.created_at,f.name AS form_name FROM form_submissions s JOIN form_definitions f ON f.id=s.form_id ${condition} ORDER BY s.created_at DESC,s.id DESC LIMIT ? OFFSET ?`,[...params,query.limit,(query.page-1)*query.limit]);
  res.json({items:rows.map((row)=>({...row,id:Number(row.id),form_id:Number(row.form_id),data:parseStoredJson(row.data),consent_given:Boolean(row.consent_given)})),pagination:{page:query.page,limit:query.limit,total:Number(count.total),pages:Math.ceil(Number(count.total)/query.limit)}});
}));

formsAdminRouter.get('/inbox/export.csv',requirePermission('forms.view'),asyncHandler(async(_req,res)=>{
  const [rows]=await pool.query<RowDataPacket[]>('SELECT s.id,s.form_id,s.data,s.consent_given,s.created_at,f.name AS form_name FROM form_submissions s JOIN form_definitions f ON f.id=s.form_id ORDER BY s.created_at DESC,s.id DESC LIMIT 10000');
  const quote=(value:unknown)=>`"${String(value??'').replace(/[\r\n]+/g,' ').replace(/"/g,'""')}"`;
  const lines=[['id','formulario','dados','consentimento','criado_em'].map(quote).join(','),...rows.map((row)=>[row.id,row.form_name,JSON.stringify(parseStoredJson(row.data)),row.consent_given?'sim':'não',row.created_at].map(quote).join(','))];
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="mensagens.csv"');res.send(`\uFEFF${lines.join('\r\n')}`);
}));

formsAdminRouter.delete('/inbox/:id',requirePermission('forms.manage'),asyncHandler(async(req,res)=>{
  const id=idSchema.parse(req.params.id);const [result]=await pool.query<ResultSetHeader>('DELETE FROM form_submissions WHERE id=?',[id]);if(!result.affectedRows)throw new HttpError(404,'Mensagem não encontrada.');
  await audit(req,'form_submission.delete','form_submission',id);res.json({ok:true});
}));

formsAdminRouter.get('/definitions',requirePermission('forms.manage'),asyncHandler(async(_req,res)=>{
  const [rows]=await pool.query<RowDataPacket[]>('SELECT id,name,fields,recipient_email,success_message,error_message FROM form_definitions ORDER BY id DESC');
  res.json({forms:rows.map((row)=>({...row,id:Number(row.id),fields:parseStoredFields(row.fields)}))});
}));
formsAdminRouter.post('/definitions',requirePermission('forms.manage'),asyncHandler(async(req,res)=>{
  const data=definitionInput.parse(req.body);const [result]=await pool.query<ResultSetHeader>('INSERT INTO form_definitions (name,fields,recipient_email,success_message,error_message) VALUES (?,?,?,?,?)',[data.name,JSON.stringify(data.fields),data.recipient_email||null,data.success_message,data.error_message]);
  await audit(req,'form_definition.create','form_definition',result.insertId,{name:data.name});res.status(201).json({id:result.insertId});
}));
formsAdminRouter.patch('/definitions/:id',requirePermission('forms.manage'),asyncHandler(async(req,res)=>{
  const id=idSchema.parse(req.params.id);const data=definitionInput.partial().strict().refine((value)=>Object.keys(value).length>0).parse(req.body);const [rows]=await pool.query<RowDataPacket[]>('SELECT id FROM form_definitions WHERE id=?',[id]);if(!rows[0])throw new HttpError(404,'Formulário não encontrado.');
  const assignments:string[]=[];const values:unknown[]=[];for(const [key,value] of Object.entries(data)){assignments.push(`${key}=?`);values.push(key==='fields'?JSON.stringify(value):value||null);}await pool.query(`UPDATE form_definitions SET ${assignments.join(',')} WHERE id=?`,[...values,id]);
  await audit(req,'form_definition.update','form_definition',id,{...data,fields:data.fields?'updated':undefined});res.json({ok:true});
}));
formsAdminRouter.delete('/definitions/:id',requirePermission('forms.manage'),asyncHandler(async(req,res)=>{
  const id=idSchema.parse(req.params.id);const [result]=await pool.query<ResultSetHeader>('DELETE FROM form_definitions WHERE id=?',[id]);if(!result.affectedRows)throw new HttpError(404,'Formulário não encontrado.');
  await audit(req,'form_definition.delete','form_definition',id);res.json({ok:true});
}));
