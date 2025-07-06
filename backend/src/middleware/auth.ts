import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { UserRole } from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authentication' });
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
};

export const authorizeTeamAccess = async (req: AuthRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { teamId } = req.params;
    const user = req.user;

    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
      return next();
    }

    if (user.role === UserRole.CAPTAIN && user.teamId?.toString() === teamId) {
      return next();
    }

    if (user.role === UserRole.PLAYER && user.teamId?.toString() === teamId) {
      req.user.limitedAccess = true;
      return next();
    }

    return res.status(403).json({ error: 'Access denied to this team' });
  } catch (error) {
    return res.status(500).json({ error: 'Authorization error' });
  }
};