import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../db/redis';
import { TooManyRequests, ApiError } from '../errors';
import { logger } from '../logger';

const WINDOW_SEC = 60;
const MAX_REQUESTS = 60; // default max per minute

export const rateLimiter = (limit: number = MAX_REQUESTS, window: number = WINDOW_SEC) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const userId = user?.id || req.ip; // Fallback to IP if not auth
            const key = `ratelimit:${req.baseUrl}${req.path}:${userId}`;

            const redis = getRedis();
            if (redis) {
                const current = await redis.incr(key);
                if (current === 1) {
                    await redis.expire(key, window);
                }

                if (current > limit) {
                    logger.warn({ userId, path: req.path }, 'Rate limit exceeded');
                    throw TooManyRequests('Rate limit exceeded, please try again later.');
                }
            }
            next();
        } catch (err) {
            if (err instanceof ApiError) next(err);
            else {
                // Fail open if Redis is down, but log it
                logger.warn({ err }, 'Rate limiter failed');
                next();
            }
        }
    };
};
