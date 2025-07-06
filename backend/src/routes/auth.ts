import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { sendTokenResponse } from '../services/authService';
import { AzureAdService } from '../services/azureAdService';
import { auditLogger } from '../middleware/logging';
import { ActionType } from '../models/AuditLog';
import logger from '../utils/logger';

const router = Router();

// Microsoft Azure AD authentication
router.post('/microsoft', 
  body('token').notEmpty().withMessage('Access token is required'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        res.status(400).json({ 
          success: false,
          error: 'Validation failed',
          details: errors.array() 
        });
        return;
      }

      const { token } = req.body;
      console.log('Received token:', token ? 'Token present' : 'No token');

      // Get user info from Microsoft Graph
      const userInfo = await AzureAdService.getUserInfo(token);
      
      // Sync user with database
      const user = await AzureAdService.syncUser(userInfo, req.ip);

      // Send token response
      sendTokenResponse(user, 200, res);
    } catch (error: any) {
      logger.error('Microsoft authentication error:', error);
      console.error('Auth error details:', error.message);
      
      // Send more specific error message
      res.status(401).json({ 
        success: false, 
        error: error.message || 'Authentication failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Local login (for existing functionality)
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  auditLogger(ActionType.LOGIN, 'User'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email, authProvider: 'local' }).select('+password');

      if (!user || !(await user.comparePassword!(password))) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      if (!user.isActive) {
        res.status(401).json({ error: 'Account is deactivated' });
        return;
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      sendTokenResponse(user, 200, res);
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.cookie('token', '', {
    expires: new Date(0),
    httpOnly: true
  });
  
  res.status(200).json({ success: true });
});

export default router;