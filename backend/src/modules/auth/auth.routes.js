import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as controller from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', controller.register);
authRouter.post('/login', controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', authenticate, controller.me);
