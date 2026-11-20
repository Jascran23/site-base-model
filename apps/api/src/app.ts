import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { attachSession, csrfProtection } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { asyncHandler } from './lib/errors.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { mediaRouter } from './modules/media/media.routes.js';
import { pagesRouter, previewRouter } from './modules/pages/pages.routes.js';
import { templatesRouter } from './modules/templates/templates.routes.js';
import { themeRouter } from './modules/theme/theme.routes.js';
import { publicRouter } from './modules/public/public.routes.js';
import { formsAdminRouter, publicFormsRouter } from './modules/forms/forms.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { seoRouter, sendRobots, sendSitemap } from './modules/seo/seo.routes.js';
import { installPublicRendering } from './public-ssr.js';
import { env } from './config/env.js';
import path from 'node:path';

export async function createApp() {
  const app = express();
  app.set('trust proxy', env.isProd ? 1 : false);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, project: env.PROJECT_NAME }));

  app.use('/api', attachSession, csrfProtection);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/pages', pagesRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/theme', themeRouter);
  app.use('/api/preview', previewRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/public/forms', publicFormsRouter);
  app.use('/api/forms', formsAdminRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/seo', seoRouter);

  // Arquivos publicados: nomes UUID gerados pelo servidor, sem listagem nem execução.
  app.get('/uploads/:filename', (req, res, next) => {
    const filename = req.params.filename;
    if (!/^[0-9a-f-]{36}\.(?:webp|jpg|png|gif)$/i.test(filename)) return res.status(404).end();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path.join(env.storageDir, filename), (err) => { if (err && !res.headersSent) res.status(404).end(); });
  });

  app.use('/api', notFound);
  app.get('/sitemap.xml', asyncHandler(async(_req,res)=>sendSitemap(res)));
  app.get('/robots.txt', (_req,res)=>sendRobots(res));
  await installPublicRendering(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
