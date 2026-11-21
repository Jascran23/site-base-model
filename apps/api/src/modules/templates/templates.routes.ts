import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pageDraftSchema, sectionInstanceSchema } from '@cms/shared/section-registry';
import { pool } from '../../db/pool.js';
import { asyncHandler, HttpError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { pageDraftFromDb } from '../pages/pages.service.js';

export const templatesRouter = Router();
templatesRouter.use(requireAuth);
const idSchema=z.coerce.number().int().positive();
const schema=z.object({ segment:z.enum(['advocacia','saude','institucional','custom']), name:z.string().trim().min(2).max(120), kind:z.enum(['page','section']), content:z.unknown() }).strict().superRefine((data,ctx)=>{
  const parsed=data.kind==='page'?pageDraftSchema.safeParse(data.content):sectionInstanceSchema.safeParse(data.content);
  if(!parsed.success) for(const issue of parsed.error.issues) ctx.addIssue({...issue,path:['content',...issue.path]});
});
function validatedContent(kind:'page'|'section',content:unknown){const parsed=kind==='page'?pageDraftSchema.safeParse(content):sectionInstanceSchema.safeParse(content);if(!parsed.success)throw new HttpError(400,'Conteúdo inválido para o modelo.','VALIDATION_ERROR');return parsed.data;}

templatesRouter.get('/available',requirePermission('pages.create'),asyncHandler(async(req,res)=>{
  const segment=z.enum(['advocacia','saude','institucional']).optional().parse(req.query.segment);
  const [rows]=await pool.query<RowDataPacket[]>("SELECT id,segment,name,kind FROM templates WHERE kind='page' AND (? IS NULL OR segment=? OR segment='custom') ORDER BY segment,name",[segment??null,segment??null]);
  res.json({templates:rows});
}));
templatesRouter.get('/',requirePermission('templates.manage'),asyncHandler(async(_req,res)=>{
  const [rows]=await pool.query<RowDataPacket[]>('SELECT id,segment,name,kind,content,created_at FROM templates ORDER BY segment,name');res.json({templates:rows});
}));
templatesRouter.post('/',requirePermission('templates.manage'),asyncHandler(async(req,res)=>{
  const data=schema.parse(req.body);const content=validatedContent(data.kind,data.content);
  const [result]=await pool.query<ResultSetHeader>('INSERT INTO templates (segment,name,kind,content) VALUES (?,?,?,?)',[data.segment,data.name,data.kind,JSON.stringify(content)]);
  await audit(req,'template.create','template',result.insertId,{segment:data.segment,name:data.name,kind:data.kind});res.status(201).json({id:result.insertId});
}));
templatesRouter.patch('/:id',requirePermission('templates.manage'),asyncHandler(async(req,res)=>{
  const id=idSchema.parse(req.params.id);const data=z.object({segment:z.enum(['advocacia','saude','institucional','custom']).optional(),name:z.string().trim().min(2).max(120).optional(),kind:z.enum(['page','section']).optional(),content:z.unknown().optional()}).strict().refine((x)=>Object.keys(x).length>0).parse(req.body);
  const [rows]=await pool.query<RowDataPacket[]>('SELECT kind FROM templates WHERE id=?',[id]);if(!rows[0])throw new HttpError(404,'Modelo não encontrado.');
  const kind=data.kind??rows[0].kind;const content=data.content===undefined?undefined:validatedContent(kind,data.content);
  await pool.query('UPDATE templates SET segment=COALESCE(?,segment),name=COALESCE(?,name),kind=COALESCE(?,kind),content=COALESCE(?,content) WHERE id=?',[data.segment??null,data.name??null,data.kind??null,content?JSON.stringify(content):null,id]);
  await audit(req,'template.update','template',id,{...data,content:undefined});res.json({ok:true});
}));
templatesRouter.delete('/:id',requirePermission('templates.manage'),asyncHandler(async(req,res)=>{const id=idSchema.parse(req.params.id);const [result]=await pool.query<ResultSetHeader>('DELETE FROM templates WHERE id=?',[id]);if(!result.affectedRows)throw new HttpError(404,'Modelo não encontrado.');await audit(req,'template.delete','template',id);res.json({ok:true});}));
templatesRouter.post('/from-page/:id',requirePermission('templates.manage'),asyncHandler(async(req,res)=>{
  const id=idSchema.parse(req.params.id);const input=z.object({segment:z.enum(['advocacia','saude','institucional','custom']),name:z.string().trim().min(2).max(120)}).strict().parse(req.body);
  const [rows]=await pool.query<RowDataPacket[]>("SELECT content FROM page_versions WHERE page_id=? AND kind='draft' ORDER BY id DESC LIMIT 1",[id]);if(!rows[0])throw new HttpError(404,'Rascunho não encontrado.');
  const content=pageDraftFromDb(rows[0].content);
  const [result]=await pool.query<ResultSetHeader>('INSERT INTO templates (segment,name,kind,content) VALUES (?,? ,\'page\',?)',[input.segment,input.name,JSON.stringify(content)]);
  await audit(req,'template.from_page','template',result.insertId,{page_id:id,name:input.name});res.status(201).json({id:result.insertId});
}));
