import jwt, { SignOptions } from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { Response } from 'express';

export const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  const options: SignOptions = {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  } as SignOptions;
  
  return jwt.sign({ id }, secret, options);
};

export const sendTokenResponse = (user: IUser, statusCode: number, res: Response) => {
  const userId = (user._id as any).toString();
  const token = generateToken(userId);

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