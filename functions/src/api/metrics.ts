import { NextFunction, Request, Response } from 'express';

export function metricsMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
