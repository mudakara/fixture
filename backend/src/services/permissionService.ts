import Permission, { IPermission } from '../models/Permission';
import logger from '../utils/logger';

interface PermissionCheck {
  resource: string;
  action: string;
}

const defaultPermissions = {
  super_admin: [
    { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'teams', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'fixtures', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'players', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'reports', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'roles', actions: ['read', 'update'] },
    { resource: 'permissions', actions: ['read', 'update'] }
  ],
  admin: [
    { resource: 'teams', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'fixtures', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'players', actions: ['create', 'read', 'update'] },
    { resource: 'reports', actions: ['read'] }
  ],
  captain: [
    { resource: 'teams', actions: ['read', 'update'] },
    { resource: 'fixtures', actions: ['read', 'update'] },
    { resource: 'players', actions: ['read', 'update'] }
  ],
  vicecaptain: [
    { resource: 'teams', actions: ['read', 'update'] },
    { resource: 'fixtures', actions: ['read', 'update'] },
    { resource: 'players', actions: ['read', 'update'] }
  ],
  player: [
    { resource: 'teams', actions: ['read'] },
    { resource: 'fixtures', actions: ['read'] },
    { resource: 'players', actions: ['read'] }
  ]
};

export class PermissionService {
  static async initializeDefaultPermissions(): Promise<void> {
    try {
      for (const [role, permissions] of Object.entries(defaultPermissions)) {
        const existingPermission = await Permission.findOne({ role });
        
        if (!existingPermission) {
          await Permission.create({ role, permissions });
          logger.info(`Created default permissions for role: ${role}`);
        }
      }
    } catch (error) {
      logger.error('Error initializing default permissions:', error);
    }
  }

  static async hasPermission(role: string, check: PermissionCheck): Promise<boolean> {
    try {
      // Super admin always has all permissions
      if (role === 'super_admin') {
        return true;
      }

      const rolePermission = await Permission.findOne({ role });
      
      if (!rolePermission) {
        // If no permission document exists, use defaults
        const defaultPerms = defaultPermissions[role as keyof typeof defaultPermissions];
        if (!defaultPerms) return false;
        
        const resourcePerm = defaultPerms.find(p => p.resource === check.resource);
        return resourcePerm ? resourcePerm.actions.includes(check.action) : false;
      }

      const resourcePermission = rolePermission.permissions.find(
        p => p.resource === check.resource
      );

      return resourcePermission ? resourcePermission.actions.includes(check.action) : false;
    } catch (error) {
      logger.error('Error checking permission:', error);
      return false;
    }
  }

  static async updatePermissions(role: string, permissions: any[]): Promise<IPermission | null> {
    try {
      const updated = await Permission.findOneAndUpdate(
        { role },
        { permissions },
        { new: true, upsert: true }
      );
      
      logger.info(`Updated permissions for role: ${role}`);
      return updated;
    } catch (error) {
      logger.error('Error updating permissions:', error);
      return null;
    }
  }

  static async getPermissionsByRole(role: string): Promise<IPermission | null> {
    try {
      const permission = await Permission.findOne({ role });
      
      if (!permission) {
        // Return default permissions if none exist
        const defaultPerms = defaultPermissions[role as keyof typeof defaultPermissions];
        if (defaultPerms) {
          return {
            role,
            permissions: defaultPerms
          } as any;
        }
      }
      
      return permission;
    } catch (error) {
      logger.error('Error fetching permissions:', error);
      return null;
    }
  }

  static async getAllPermissions(): Promise<IPermission[]> {
    try {
      return await Permission.find({});
    } catch (error) {
      logger.error('Error fetching all permissions:', error);
      return [];
    }
  }
}