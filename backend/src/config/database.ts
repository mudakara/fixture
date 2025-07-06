import mongoose from 'mongoose';
import winston from 'winston';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI as string);
    winston.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    winston.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;