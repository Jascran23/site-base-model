import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../../lib/errors.js';
import { getPublishedPage, getPublicSite } from './public.service.js';

export const publicRouter=Router();
const slugSchema=z.string().min(1).max(190).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
publicRouter.get('/site',asyncHandler(async(_req,res)=>{res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.json(await getPublicSite());}));
publicRouter.get('/home',asyncHandler(async(_req,res)=>{const page=await getPublishedPage(null);if(!page)throw new HttpError(404,'Página inicial não encontrada.');res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.json(page);}));
publicRouter.get('/pages/:slug',asyncHandler(async(req,res)=>{const slug=slugSchema.parse(req.params.slug);const page=await getPublishedPage(slug);if(!page)throw new HttpError(404,'Página não encontrada.');res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.json(page);}));
