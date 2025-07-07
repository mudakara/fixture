# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MatchMaker Pro is a sports fixture management system with role-based access control, built with Next.js, Node.js, Express, and MongoDB. The application uses Microsoft Azure AD for authentication with automatic user synchronization.

### Hierarchical Structure
The application follows an Event-Team-Player hierarchy:
- **Organization** hosts multiple **Events**
- Each **Event** contains multiple **Teams**
- Each **Team** has multiple **Players** (users)

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
- `backend/src/models/` - MongoDB models (User, Event, Team, Fixture, AuditLog, Permission)
- `backend/src/middleware/` - Auth and logging middleware
- `backend/src/routes/` - API endpoints (auth, users, permissions, events, teams)
- `backend/src/services/` - Business logic (authService, azureAdService, permissionService)
- `backend/src/config/` - Configuration files (database, Azure AD)
- `backend/src/utils/` - Utilities (logger)
- `backend/logs/` - Log files (auto-created)
- `backend/uploads/` - Storage for event and team images

### Frontend Structure
- `frontend/app/` - Next.js 14 app directory
  - `login/` - Microsoft SSO login page
  - `dashboard/` - Protected dashboard with statistics and quick actions
  - `profile/` - User profile page with tabs
  - `roles/` - User and permissions management (super admin only)
  - `events/` - Event management (list, create, detail views)
  - `events/[id]/` - Event detail with teams
  - `events/[eventId]/teams/create` - Create team for event
  - `teams/` - Team listing with event filter
  - `teams/[id]/` - Team detail with players
  - `fixtures/`, `players/`, `reports/`, `settings/` - Feature pages
- `frontend/src/components/` - React components (AuthGuard, Header)
- `frontend/src/store/` - Redux store and auth slice
- `frontend/src/providers/` - MSAL and Redux providers
- `frontend/src/hooks/` - Custom hooks (useAuth)
- `frontend/src/config/` - MSAL configuration
- `frontend/middleware.ts` - Next.js middleware for route protection

### Key Features

1. **Event Management System**
   - Create and manage events with start/end dates
   - Upload event images/logos
   - Track event status (upcoming, ongoing, ended)
   - Event-based team organization

2. **Team Management**
   - Create teams within events
   - Assign captains and vice-captains
   - Upload team logos
   - Manage team players
   - Filter teams by event

3. **Role-Based Access Control**
   - Super Admin: Full system access, user management, permissions configuration
   - Admin: Create/manage events and teams
   - Captain: Manage own team and players
   - Vice Captain: Same permissions as Captain
   - Player: View team and event information

4. **User Management System** (Super Admin only)
   - View all users with sortable columns (Name, Role)
   - Create new users manually with Add User button
   - Edit user roles with improved dropdown UI
   - Delete users (except super admins who are protected)
   - Azure AD to local user conversion support
   - Auth type indicator (Azure AD vs Local)

5. **Permissions System**
   - Dynamic role-based permissions configuration
   - Resource-based access control (users, teams, fixtures, players, reports, roles, permissions)
   - CRUD actions per resource (create, read, update, delete)
   - Visual permissions matrix for easy management

6. **Enhanced UI Components**
   - Header with logo, navigation menu, user info, and logout
   - User dropdown menu with profile and settings links
   - Dashboard with statistics cards and quick actions
   - Profile page with Overview, Team Info, and Activity Log tabs
   - Responsive design with mobile menu support

7. **Logging System**
   - All actions logged to files in `backend/logs/`
   - Audit trail stored in MongoDB with proper schema
   - Winston logger with rotation
   - Tracks user actions: create, update, delete, login, logout

8. **Authentication**
   - JWT with httpOnly cookies
   - Microsoft Azure AD SSO integration (primary authentication method)
   - Automatic user creation/update on first login
   - Local to Azure AD conversion when same email logs in via SSO
   - Support for multi-tenant and personal Microsoft accounts
   - Default super admin: admin@matchmakerpro.com / changethispassword (local auth)

## API Endpoints

### Authentication
- `POST /api/auth/microsoft` - Authenticate with Microsoft token
- `POST /api/auth/login` - Local authentication
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create new event (Admin only)
- `GET /api/events/:id` - Get event with teams
- `PUT /api/events/:id` - Update event (Admin only)
- `DELETE /api/events/:id` - Soft delete event (Admin only)
- `GET /api/events/:id/stats` - Get event statistics

### Teams
- `GET /api/teams` - Get all teams (with optional event filter)
- `POST /api/teams` - Create new team (Admin only)
- `GET /api/teams/:id` - Get team details
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Soft delete team (Admin only)
- `POST /api/teams/:id/players` - Add player to team
- `DELETE /api/teams/:id/players/:playerId` - Remove player from team

### Users (Super Admin only)
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PUT /api/users/:userId/role` - Update user role
- `DELETE /api/users/:userId` - Delete user
- `GET /api/users/stats` - Get user statistics

### Permissions (Super Admin only)
- `GET /api/permissions` - Get all permissions
- `GET /api/permissions/:role` - Get permissions for a role
- `PUT /api/permissions/:role` - Update role permissions
- `POST /api/permissions/check` - Check user permission

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
10. **Role Naming** - Roles use underscores (super_admin, vice_captain) in database
11. **File Uploads** - Multer handles image uploads for events and teams, stored in backend/uploads/
12. **Data Relationships** - Events → Teams → Players (Users) hierarchy with MongoDB references

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
2. **Port Already in Use**: Kill existing processes with `pkill -f nodemon` or `lsof -ti:PORT | xargs kill -9`
3. **MongoDB Connection**: Ensure MongoDB is running locally
4. **Azure AD Errors**: Check redirect URI matches exactly in Azure Portal
5. **TypeScript Errors**: Run `npm run build` in backend to check for errors
6. **localStorage Errors**: All localStorage access is wrapped with `typeof window !== 'undefined'`
7. **AuditLog Validation**: Use correct schema - entity (not resource), action enum values