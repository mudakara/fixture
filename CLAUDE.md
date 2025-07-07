# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MatchMaker Pro is a comprehensive sports fixture management system with role-based access control, built with Next.js, Node.js, Express, and MongoDB. The application uses Microsoft Azure AD for authentication with automatic user synchronization.

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
  - `profile/` - User profile page with tabs (Overview, Team Info, Activity Log)
  - `roles/` - User and permissions management (super admin only)
  - `events/` - Event management (list, create, detail views)
  - `events/[id]/` - Event detail with teams
  - `events/[eventId]/teams/create` - Create team for event
  - `teams/` - Team listing with event filter
  - `teams/[id]/` - Team detail with players
  - `teams/[id]/players` - Manage team players
  - `fixtures/`, `players/`, `reports/`, `settings/` - Feature pages
- `frontend/src/components/` - React components (AuthGuard, Header)
- `frontend/src/store/` - Redux store and auth slice
- `frontend/src/providers/` - MSAL and Redux providers
- `frontend/src/hooks/` - Custom hooks (useAuth)
- `frontend/src/config/` - MSAL configuration
- `frontend/middleware.ts` - Next.js middleware for route protection

### Database Models

#### User Model
```typescript
{
  name: string
  email: string
  password?: string // Only for local auth
  role: 'super_admin' | 'admin' | 'captain' | 'vicecaptain' | 'player'
  teamMemberships: [{
    teamId: ObjectId
    eventId: ObjectId
    role: 'captain' | 'vicecaptain' | 'player'
    joinedAt: Date
  }]
  authProvider: 'local' | 'azuread'
  azureAdId?: string
  displayName?: string
  // Additional Azure AD fields
}
```

#### Event Model
```typescript
{
  name: string
  description?: string
  eventImage?: string
  startDate: Date
  endDate: Date
  createdBy: ObjectId (User)
  isActive: boolean
  // Virtual fields: isOngoing, hasEnded, isUpcoming
}
```

#### Team Model
```typescript
{
  name: string
  teamLogo?: string
  eventId: ObjectId (Event)
  captainId: ObjectId (User)
  viceCaptainId: ObjectId (User)
  players: [ObjectId] (Users)
  createdBy: ObjectId (User)
  isActive: boolean
  // Virtual field: playerCount
}
```

### Key Features

1. **Event Management System**
   - Create and manage events with start/end dates
   - Upload event images/logos (5MB max)
   - Track event status (upcoming, ongoing, ended)
   - Event-based team organization
   - Event statistics (team count, total players)
   - Soft delete functionality

2. **Team Management**
   - Create teams within events
   - Assign captains and vice-captains from user list
   - Upload team logos (5MB max)
   - Manage team players (add/remove)
   - Filter teams by event
   - Captain and vice-captain cannot be the same person
   - Automatic addition of captain/vice-captain to players list

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
   - User statistics dashboard

5. **Permissions System**
   - Dynamic role-based permissions configuration
   - Resource-based access control (users, events, teams, fixtures, players, reports, roles, permissions)
   - CRUD actions per resource (create, read, update, delete)
   - Visual permissions matrix for easy management
   - Default permissions for each role

6. **Enhanced UI Components**
   - Header with logo, navigation menu, user info, and logout
   - User dropdown menu with profile and settings links
   - Dashboard with statistics cards and quick actions
   - Profile page with Overview, Team Info, and Activity Log tabs
   - Responsive design with mobile menu support
   - Image preview for uploads
   - Searchable dropdowns for user selection
   - Sortable table columns

7. **Logging System**
   - All actions logged to files in `backend/logs/`
   - Audit trail stored in MongoDB with proper schema
   - Winston logger with rotation
   - Tracks user actions: create, update, delete, login, logout
   - Request logging with duration and status codes

8. **Authentication**
   - JWT with httpOnly cookies
   - Microsoft Azure AD SSO integration (primary authentication method)
   - Automatic user creation/update on first login
   - Local to Azure AD conversion when same email logs in via SSO
   - Support for multi-tenant and personal Microsoft accounts
   - Default super admin: admin@matchmakerpro.com / changethispassword (local auth)
   - Session management with Redux

## API Endpoints

### Authentication
- `POST /api/auth/microsoft` - Authenticate with Microsoft token
  - Body: `{ token: string }`
  - Returns: `{ success: boolean, user: User, token: string }`
- `POST /api/auth/login` - Local authentication
  - Body: `{ email: string, password: string }`
  - Returns: `{ success: boolean, user: User, token: string }`
- `POST /api/auth/logout` - Logout user
  - Returns: `{ success: boolean, message: string }`
- `GET /api/auth/me` - Get current user
  - Returns: `{ success: boolean, user: User }`

### Events
- `GET /api/events` - Get all events
  - Returns: `{ success: boolean, events: Event[] }`
- `POST /api/events` - Create new event (Admin only)
  - Body: FormData with `name`, `description`, `startDate`, `endDate`, `eventImage`
  - Returns: `{ success: boolean, event: Event }`
- `GET /api/events/:id` - Get event with teams
  - Returns: `{ success: boolean, event: Event, teams: Team[] }`
- `PUT /api/events/:id` - Update event (Admin only)
  - Body: FormData with updated fields
  - Returns: `{ success: boolean, event: Event }`
- `DELETE /api/events/:id` - Soft delete event (Admin only)
  - Returns: `{ success: boolean, message: string }`
- `GET /api/events/:id/stats` - Get event statistics
  - Returns: `{ success: boolean, stats: EventStats }`

### Teams
- `GET /api/teams` - Get all teams (with optional event filter)
  - Query: `?eventId=xxx`
  - Returns: `{ success: boolean, teams: Team[] }`
- `POST /api/teams` - Create new team (Admin only)
  - Body: FormData with `name`, `eventId`, `captainId`, `viceCaptainId`, `teamLogo`
  - Returns: `{ success: boolean, team: Team }`
- `GET /api/teams/:id` - Get team details
  - Returns: `{ success: boolean, team: Team }`
- `PUT /api/teams/:id` - Update team
  - Body: FormData with updated fields
  - Returns: `{ success: boolean, team: Team }`
- `DELETE /api/teams/:id` - Soft delete team (Admin only)
  - Returns: `{ success: boolean, message: string }`
- `POST /api/teams/:id/players` - Add player to team
  - Body: `{ playerId: string }`
  - Returns: `{ success: boolean, player: User }`
- `DELETE /api/teams/:id/players/:playerId` - Remove player from team
  - Returns: `{ success: boolean, message: string }`

### Users (Super Admin only)
- `GET /api/users` - Get all users
  - Returns: `{ success: boolean, users: User[] }`
- `POST /api/users` - Create new user
  - Body: `{ name: string, email: string, password: string, role: string }`
  - Returns: `{ success: boolean, user: User }`
- `PUT /api/users/:userId/role` - Update user role
  - Body: `{ role: string }`
  - Returns: `{ success: boolean, user: User }`
- `DELETE /api/users/:userId` - Delete user
  - Returns: `{ success: boolean, message: string }`
- `GET /api/users/stats` - Get user statistics
  - Returns: `{ success: boolean, stats: UserStats }`

### Permissions (Super Admin only)
- `GET /api/permissions` - Get all permissions
  - Returns: `{ success: boolean, permissions: Permission[] }`
- `GET /api/permissions/:role` - Get permissions for a role
  - Returns: `{ success: boolean, permissions: Permission }`
- `PUT /api/permissions/:role` - Update role permissions
  - Body: `{ permissions: Permission[] }`
  - Returns: `{ success: boolean, permissions: Permission }`
- `POST /api/permissions/check` - Check user permission
  - Body: `{ resource: string, action: string }`
  - Returns: `{ success: boolean, hasPermission: boolean }`

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
13. **Soft Deletes** - Events and teams use isActive flag instead of hard deletion
14. **Image Formats** - Supported: JPEG, JPG, PNG, GIF, WebP (5MB max)
15. **Date Validation** - Event end date must be after or equal to start date

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
8. **File Upload Errors**: Ensure backend/uploads directory exists with write permissions
9. **Image Not Loading**: Check static file serving is configured in Express
10. **Team Creation Fails**: Verify captain and vice-captain are different users

## Recent Updates

### Event-Team-Player Architecture (Latest)
- Implemented hierarchical structure for organizations
- Created Event and Team models with relationships
- Added comprehensive CRUD operations for events and teams
- Implemented file upload for images
- Created UI for event and team management
- Added player management within teams

### User Management System
- Added sortable columns for user list
- Implemented user deletion (except super admins)
- Added Azure AD to local user conversion
- Created user statistics endpoint

### UI Enhancements
- Created responsive header with navigation
- Added user profile page with tabs
- Implemented dashboard with statistics
- Added dropdown menus and mobile support

### Permission System
- Implemented dynamic role-based permissions
- Created visual permission matrix
- Added permission checking endpoints