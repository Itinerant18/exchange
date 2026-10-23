import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate } from '../../middleware/authenticate.js';
import { isUuid } from '../../utils/validators.js';
import * as service from './users.service.js';

export const usersRouter = Router();
usersRouter.use(authenticate);

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  return body;
}

function assertIdParam(value) {
  if (!isUuid(value)) {
    throw new AppError('The identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  return value;
}

usersRouter.get('/me/profile', async (req, res, next) => {
  try {
    res.status(200).json({ data: await service.getMyProfile(req.authUser.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/profile', async (req, res, next) => {
  try {
    const body = assertObject(req.body);
    res.status(200).json({ data: await service.updateMyProfile(req.authUser.id, body) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me/addresses', async (req, res, next) => {
  try {
    res.status(200).json({ data: await service.listMyAddresses(req.authUser.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/me/addresses', async (req, res, next) => {
  try {
    const body = assertObject(req.body);
    res.status(201).json({ data: await service.createAddress(req.authUser.id, body) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me/addresses/:id', async (req, res, next) => {
  try {
    assertIdParam(req.params.id);
    res.status(200).json({ data: await service.getMyAddress(req.authUser.id, req.params.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/addresses/:id', async (req, res, next) => {
  try {
    assertIdParam(req.params.id);
    const body = assertObject(req.body);
    res.status(200).json({ data: await service.updateAddress(req.authUser.id, req.params.id, body) });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete('/me/addresses/:id', async (req, res, next) => {
  try {
    assertIdParam(req.params.id);
    await service.deleteAddress(req.authUser.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
