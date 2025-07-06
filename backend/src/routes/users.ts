import express, { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { authenticate } from '../middleware/auth';
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

// Create a new user (Super Admin only)
router.post('/users', authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    const adminUser = (req as any).user;

    // Validate required fields
    if (!name || !email || !password || !role) {
      res.status(400).json({ error: 'Name, email, password, and role are required' });
      return;
    }

    // Validate role
    const validRoles = ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }

    // Create new user
    const newUser = await User.create({
      name,
      email,
      password,
      role,
      authProvider: 'local',
      isActive: true
    });

    // Create audit log
    await AuditLog.create({
      userId: adminUser._id,
      action: 'create',
      entity: 'user',
      entityId: newUser._id,
      details: {
        userEmail: newUser.email,
        userRole: newUser.role,
        createdBy: adminUser.email
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('User created manually', {
      adminId: adminUser._id,
      newUserId: newUser._id,
      newUserEmail: newUser.email
    });

    res.json({ 
      success: true, 
      message: 'User created successfully',
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error: any) {
    logger.error('Error creating user:', error);
    // Send more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message || 'Failed to create user'
      : 'Failed to create user';
    res.status(500).json({ error: errorMessage });
  }
});

// Get all users (Super Admin only)
router.get('/users', authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 });

    logger.info('Fetched all users', { 
      adminId: (req as any).user._id,
      userCount: users.length 
    });

    res.json({ success: true, users });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (Super Admin only)
router.put('/users/:userId/role', authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminUser = (req as any).user;

    // Validate role
    const validRoles = ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    // Prevent changing own role
    if (userId === adminUser._id.toString()) {
      res.status(400).json({ error: 'Cannot change your own role' });
      return;
    }

    // Find and update user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    // Create audit log
    await AuditLog.create({
      userId: adminUser._id,
      action: 'update',
      entity: 'user',
      entityId: userId,
      details: {
        targetUserEmail: user.email,
        oldRole,
        newRole: role,
        fieldUpdated: 'role'
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('User role updated', {
      adminId: adminUser._id,
      targetUserId: userId,
      oldRole,
      newRole: role
    });

    res.json({ 
      success: true, 
      message: 'User role updated successfully',
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    logger.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete a user (Super Admin only)
router.delete('/users/:userId', authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const adminUser = (req as any).user;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prevent deleting super admins
    if (user.role === 'super_admin') {
      res.status(403).json({ error: 'Cannot delete super admin users' });
      return;
    }

    // Prevent self-deletion
    if (userId === adminUser._id.toString()) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    // Store user info before deletion for audit log
    const deletedUserInfo = {
      email: user.email,
      name: user.name,
      role: user.role
    };

    // Delete the user
    await user.deleteOne();

    // Create audit log
    await AuditLog.create({
      userId: adminUser._id,
      action: 'delete',
      entity: 'user',
      entityId: userId,
      details: {
        deletedUser: deletedUserInfo,
        deletedBy: adminUser.email
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('User deleted', {
      adminId: adminUser._id,
      deletedUserId: userId,
      deletedUserEmail: deletedUserInfo.email
    });

    res.json({ 
      success: true, 
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get user statistics (Super Admin only)
router.get('/users/stats', authenticate, superAdminOnly, async (_req: Request, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const roleStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    const authProviderStats = await User.aggregate([
      { $group: { _id: '$authProvider', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        byRole: roleStats,
        byAuthProvider: authProviderStats
      }
    });
  } catch (error) {
    logger.error('Error fetching user statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;