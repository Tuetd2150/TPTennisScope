import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/apiErrors';
import { env } from '../config/env';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(env.NODE_ENV === 'development' && { stack: err.stack }),
      },
    });
    return;
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: {
      message: env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
    },
  });
}
