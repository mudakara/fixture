import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import AuditLog, { ActionType } from '../models/AuditLog';
import { AuthRequest } from './auth';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
};

export const auditLogger = (action: ActionType, entity: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalSend = res.json;
    
    res.json = function(data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        AuditLog.create({
          userId: req.user._id,
          action,
          entity,
          entityId: data._id || req.params.id,
          details: {
            method: req.method,
            path: req.originalUrl,
            body: req.body,
            params: req.params,
            query: req.query
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }).catch(err => {
          logger.error('Audit log error:', err);
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

export const errorLogger = (err: Error, req: Request, _res: Response, next: NextFunction) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  next(err);
};