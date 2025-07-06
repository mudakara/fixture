import express, { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { PermissionService } from '../services/permissionService';
import AuditLog from '../models/AuditLog';
import logger from '../utils/logger';

const router = express.Router();

// Middleware to check if user is superadmin
const superAdminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if ((req as any).user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Access denied. Super admin only.' });
    return;
  }
  next();
};

// Get all permissions (Super Admin only)
router.get('/permissions', authenticate, superAdminOnly, async (_req: Request, res: Response): Promise<void> => {
  try {
    const permissions = await PermissionService.getAllPermissions();
    res.json({ success: true, permissions });
  } catch (error) {
    logger.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Get permissions for a specific role
router.get('/permissions/:role', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.params;
    const userRole = (req as any).user.role;

    // Users can only view their own role permissions unless they're super_admin
    if (userRole !== 'super_admin' && userRole !== role) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const permissions = await PermissionService.getPermissionsByRole(role);
    res.json({ success: true, permissions });
  } catch (error) {
    logger.error('Error fetching role permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Update permissions for a role (Super Admin only)
router.put('/permissions/:role', authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;
    const adminUser = (req as any).user;

    // Validate role
    const validRoles = ['admin', 'captain', 'vicecaptain', 'player']; // Superadmin permissions can't be changed
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role or cannot modify this role' });
      return;
    }

    // Update permissions
    const updated = await PermissionService.updatePermissions(role, permissions);
    
    if (!updated) {
      res.status(500).json({ error: 'Failed to update permissions' });
      return;
    }

    // Create audit log
    await AuditLog.create({
      userId: adminUser._id,
      action: 'update',
      entity: 'permission',
      details: {
        role,
        permissions
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Permissions updated', {
      adminId: adminUser._id,
      role,
      permissionCount: permissions.length
    });

    res.json({ 
      success: true, 
      message: 'Permissions updated successfully',
      permissions: updated
    });
  } catch (error) {
    logger.error('Error updating permissions:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Check if user has permission (for internal use)
router.post('/permissions/check', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { resource, action } = req.body;
    const userRole = (req as any).user.role;

    if (!resource || !action) {
      res.status(400).json({ error: 'Resource and action are required' });
      return;
    }

    const hasPermission = await PermissionService.hasPermission(userRole, { resource, action });
    
    res.json({ 
      success: true, 
      hasPermission,
      role: userRole,
      resource,
      action
    });
  } catch (error) {
    logger.error('Error checking permission:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

export default router;