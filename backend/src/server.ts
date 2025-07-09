import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables first
dotenv.config();

// Verify environment is loaded
console.log('Loading environment from:', process.cwd() + '/.env');
console.log('Environment loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  CLIENT_URL: process.env.CLIENT_URL
});

import passport from 'passport';
import connectDB from './config/database';
import { requestLogger, errorLogger } from './middleware/logging';
import { createDefaultSuperAdmin } from './services/authService';
import { createBearerStrategy } from './config/azureAd';
import logger from './utils/logger';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import permissionsRoutes from './routes/permissions';
import eventsRoutes from './routes/events';
import teamsRoutes from './routes/teams';
import dashboardRoutes from './routes/dashboard';
import sportGamesRoutes from './routes/sportgames';
import fixtureRoutes from './routes/fixtures';
import scorecardRoutes from './routes/scorecard';
import { PermissionService } from './services/permissionService';

const app = express();
const PORT = parseInt(process.env.PORT || '3501', 10);

console.log('Environment PORT:', process.env.PORT);
console.log('Using PORT:', PORT);
console.log('CORS CLIENT_URL:', process.env.CLIENT_URL);

connectDB();

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3500',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['set-cookie'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);
app.use('/api/', limiter);

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Initialize Passport
app.use(passport.initialize());

// Only initialize Azure AD strategy if credentials are provided
if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_TENANT_ID) {
  passport.use(createBearerStrategy());
  logger.info('Azure AD authentication initialized');
} else {
  logger.warn('Azure AD credentials not found. Azure AD authentication disabled.');
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', usersRoutes);
app.use('/api', permissionsRoutes);
app.use('/api', eventsRoutes);
app.use('/api', teamsRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', sportGamesRoutes);
app.use('/api/fixtures', fixtureRoutes);
app.use('/api', scorecardRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint for CORS
app.post('/api/test-cors', (_req, res) => {
  res.json({ 
    message: 'CORS test successful', 
    cors: process.env.CLIENT_URL || 'http://localhost:3500'
  });
});

app.use(errorLogger);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  await createDefaultSuperAdmin();
  await PermissionService.initializeDefaultPermissions();
});