import axios from 'axios';
import User, { IUser, UserRole } from '../models/User';
import AuditLog, { ActionType } from '../models/AuditLog';
import logger from '../utils/logger';

interface AzureAdUserInfo {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  preferredLanguage?: string;
}

export class AzureAdService {
  static async getUserInfo(accessToken: string): Promise<AzureAdUserInfo> {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch user info from Microsoft Graph:', error);
      throw new Error('Failed to fetch user information');
    }
  }

  static async syncUser(userInfo: AzureAdUserInfo, ipAddress?: string): Promise<IUser> {
    try {
      // Check if user exists
      let user = await User.findOne({
        $or: [
          { azureAdId: userInfo.id },
          { email: userInfo.mail || userInfo.userPrincipalName }
        ]
      });

      if (user) {
        // Update existing user
        const updates: any = {
          lastLogin: new Date(),
          displayName: userInfo.displayName,
          userPrincipalName: userInfo.userPrincipalName,
          azureAdId: userInfo.id,
          authProvider: 'azuread'
        };

        // Update optional fields if they exist
        if (userInfo.jobTitle) updates.jobTitle = userInfo.jobTitle;
        if (userInfo.department) updates.department = userInfo.department;
        if (userInfo.officeLocation) updates.officeLocation = userInfo.officeLocation;
        if (userInfo.mobilePhone) updates.mobilePhone = userInfo.mobilePhone;
        if (userInfo.preferredLanguage) updates.preferredLanguage = userInfo.preferredLanguage;

        user = await User.findByIdAndUpdate(
          user._id,
          { $set: updates },
          { new: true }
        );

        // Log the login
        await AuditLog.create({
          userId: user!._id,
          action: ActionType.LOGIN,
          entity: 'User',
          entityId: user!._id,
          details: { method: 'azuread', updated: true },
          ipAddress
        });

        logger.info(`User ${user!.email} logged in via Azure AD (updated)`);
      } else {
        // Create new user
        user = await User.create({
          name: userInfo.displayName,
          email: userInfo.mail || userInfo.userPrincipalName,
          azureAdId: userInfo.id,
          displayName: userInfo.displayName,
          userPrincipalName: userInfo.userPrincipalName,
          jobTitle: userInfo.jobTitle,
          department: userInfo.department,
          officeLocation: userInfo.officeLocation,
          mobilePhone: userInfo.mobilePhone,
          preferredLanguage: userInfo.preferredLanguage,
          role: UserRole.PLAYER, // Default role
          authProvider: 'azuread',
          isActive: true,
          lastLogin: new Date()
        });

        // Log the user creation
        await AuditLog.create({
          userId: user._id,
          action: ActionType.CREATE,
          entity: 'User',
          entityId: user._id,
          details: { method: 'azuread', firstLogin: true },
          ipAddress
        });

        logger.info(`New user ${user.email} created via Azure AD`);
      }

      return user!;
    } catch (error) {
      logger.error('Failed to sync Azure AD user:', error);
      throw error;
    }
  }
}