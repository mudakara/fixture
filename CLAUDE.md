# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MatchMaker Pro is a sports fixture management system with role-based access control, built with Next.js, Node.js, Express, and MongoDB.

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
- `backend/src/routes/` - API endpoints
- `backend/src/services/` - Business logic
- `backend/src/utils/` - Utilities (logger)
- `backend/logs/` - Log files (auto-created)

### Frontend Structure
- `frontend/app/` - Next.js 14 app directory
- `frontend/components/` - React components
- `frontend/store/` - Redux store and slices
- `frontend/services/` - API client services
- `frontend/types/` - TypeScript type definitions

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
   - Default super admin: admin@matchmakerpro.com / changethispassword
   - Microsoft Azure AD SSO integration

## Important Conventions

1. **TypeScript** - Both frontend and backend use TypeScript strictly
2. **Environment Variables** - Copy `.env.example` files to `.env` files before running
3. **Git Commits** - Push to https://github.com/mudakara/fixture.git
4. **Security** - Never commit `.env` files or expose secrets
5. **Logging** - Use the logger utility for all backend logging
6. **Error Handling** - All errors should be logged and returned with appropriate HTTP status codes
7. **Ports** - Frontend runs on port 3500, Backend API runs on port 3501