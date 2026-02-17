import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../errors';

export const authenticateJWT: RequestHandler = (req, _res, next) => {
  try {
    const auth = req.header('authorization') || req.header('Authorization');
    if (!auth) throw new ApiError(401, 'Missing Authorization header', 'UNAUTHORIZED');
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') throw new ApiError(401, 'Malformed Authorization header', 'UNAUTHORIZED');
    const token = parts[1];
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      if (!decoded || !decoded.userId) throw new ApiError(401, 'Invalid token payload', 'UNAUTHORIZED');
      (req as any).user = { id: decoded.userId, username: decoded.username };
      return next();
    } catch (err: any) {
      throw new ApiError(401, 'Invalid or expired token', 'UNAUTHORIZED');
    }
  } catch (err) {
    return next(err);
  }
};
