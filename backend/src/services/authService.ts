import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { Response } from 'express';

export const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

export const sendTokenResponse = (user: IUser, statusCode: number, res: Response) => {
  const token = generateToken(user._id);

  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const
  };

  res.status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
};

export const createDefaultSuperAdmin = async () => {
  try {
    const superAdminExists = await User.findOne({ role: 'super_admin' });
    
    if (!superAdminExists) {
      await User.create({
        name: 'Super Admin',
        email: 'admin@matchmakerpro.com',
        password: 'changethispassword',
        role: 'super_admin'
      });
      console.log('Default super admin created');
    }
  } catch (error) {
    console.error('Error creating default super admin:', error);
  }
};