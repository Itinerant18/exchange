import express from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestId } from './middleware/requestId.js';
import { parseCookies } from './utils/cookies.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('json escape', true);

  app.use(requestId);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));

  // Minimal cookie parsing for the refresh-token HttpOnly cookie.
  app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
  });

  app.use(env.apiPrefix, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
