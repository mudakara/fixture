# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MatchMaker Pro is a sports fixture management system with role-based access control, built with Next.js, Node.js, Express, and MongoDB. The application uses Microsoft Azure AD for authentication with automatic user synchronization.

## Development Commands

### Quick Start
```bash
npm run install:all  # Install all dependencies
npm run dev         # Start both frontend (port 3500) and backend (port 3501)
```

### Individual Commands
- `npm run dev:frontend` - Start Next.js frontend only
- `npm run dev:backend` - Start Node.js backend only
- `npm run build` - Build both frontend and backend
- `npm run lint` - Run linting for both projects
- `npm run test` - Run tests for both projects

### Backend-specific
- `cd backend && npm run dev` - Start backend with nodemon
- `cd backend && npm run build` - Compile TypeScript
- `cd backend && npm run lint` - Run ESLint

### Frontend-specific
- `cd frontend && npm run dev` - Start Next.js development server
- `cd frontend && npm run build` - Build for production
- `cd frontend && npm run lint` - Run Next.js linting

## Architecture

### Backend Structure
- `backend/src/models/` - MongoDB models (User, Team, Fixture, AuditLog)
- `backend/src/middleware/` - Auth and logging middleware
- `backend/src/routes/` - API endpoints (auth routes for Microsoft SSO)
- `backend/src/services/` - Business logic (authService, azureAdService)
- `backend/src/config/` - Configuration files (database, Azure AD)
- `backend/src/utils/` - Utilities (logger)
- `backend/logs/` - Log files (auto-created)

### Frontend Structure
- `frontend/app/` - Next.js 14 app directory
  - `login/` - Microsoft SSO login page
  - `dashboard/` - Protected dashboard with user info
  - `test-api/` - API debugging page
- `frontend/src/components/` - React components (AuthGuard)
- `frontend/src/store/` - Redux store and auth slice
- `frontend/src/providers/` - MSAL and Redux providers
- `frontend/src/hooks/` - Custom hooks (useAuth)
- `frontend/src/config/` - MSAL configuration
- `frontend/middleware.ts` - Next.js middleware for route protection

### Key Features
1. **Role-Based Access Control**
   - Super Admin: Full system access
   - Admin: Manage teams and fixtures
   - Captain: Manage own team
   - Player: View team information

2. **Logging System**
   - All actions logged to files in `backend/logs/`
   - Audit trail stored in MongoDB
   - Winston logger with rotation

3. **Authentication**
   - JWT with httpOnly cookies
   - Microsoft Azure AD SSO integration (primary authentication method)
   - Automatic user creation/update on first login
   - Support for multi-tenant and personal Microsoft accounts
   - Default super admin: admin@matchmakerpro.com / changethispassword (local auth)

## Important Conventions

1. **TypeScript** - Both frontend and backend use TypeScript strictly
2. **Environment Variables** - Copy `.env.example` files to `.env` files before running
3. **Git Commits** - Push to https://github.com/mudakara/fixture.git
4. **Security** - Never commit `.env` files or expose secrets
5. **Logging** - Use the logger utility for all backend logging
6. **Error Handling** - All errors should be logged and returned with appropriate HTTP status codes
7. **Ports** - Frontend runs on port 3500, Backend API runs on port 3501
8. **CORS** - Backend configured to accept requests only from http://localhost:3500
9. **Authentication Flow** - Users login via Microsoft → Backend validates token → Creates/updates user → Returns JWT

## Azure AD Configuration

The application uses Azure AD for authentication:
- Client ID: 79c36f11-0407-44c7-a6e2-ba48e2bdad75
- Tenant ID: 85c3bc4b-1981-4fe1-af5a-ba455eba7701
- Redirect URI: http://localhost:3500
- Authority: https://login.microsoftonline.com/common (multi-tenant)

Required API Permissions:
- User.Read
- openid
- profile
- email

## Common Issues and Solutions

1. **CORS Errors**: Ensure backend .env has `CLIENT_URL=http://localhost:3500`
2. **Port Already in Use**: Kill existing processes with `pkill -f nodemon`
3. **MongoDB Connection**: Ensure MongoDB is running locally
4. **Azure AD Errors**: Check redirect URI matches exactly in Azure Portal
5. **TypeScript Errors**: Run `npm run build` in backend to check for errors