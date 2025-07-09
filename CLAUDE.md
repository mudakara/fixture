# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MatchMaker Pro is a comprehensive sports fixture management system with role-based access control, built with Next.js, Node.js, Express, and MongoDB. The application uses Microsoft Azure AD for authentication with automatic user synchronization.

### Hierarchical Structure
The application follows an Event-Team-Player hierarchy:
- **Organization** hosts multiple **Events**
- Each **Event** contains multiple **Teams**
- Each **Team** has multiple **Players** (users)
- **Events** can have multiple **Fixtures** for sports/games
- **Fixtures** contain **Matches** between players or teams

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
- `backend/src/models/` - MongoDB models (User, Event, Team, Fixture, Match, SportGame, AuditLog, Permission)
- `backend/src/middleware/` - Auth and logging middleware
- `backend/src/routes/` - API endpoints (auth, users, permissions, events, teams, dashboard, sportgames, fixtures)
- `backend/src/services/` - Business logic (authService, azureAdService, permissionService)
- `backend/src/config/` - Configuration files (database, Azure AD)
- `backend/src/utils/` - Utilities (logger)
- `backend/logs/` - Log files (auto-created)
- `backend/uploads/` - Storage for event and team images

### Frontend Structure
- `frontend/app/` - Next.js 14 app directory
  - `login/` - Microsoft SSO login page
  - `dashboard/` - Protected dashboard with real-time statistics and quick actions
  - `profile/` - User profile page with tabs (Overview, Team Info, Activity Log)
  - `roles/` - User and permissions management (super admin only)
  - `events/` - Event management (list, create, detail views)
  - `events/[eventId]/` - Event detail with teams (fixed for Next.js 15 async params)
  - `events/[eventId]/teams/create` - Create team for event
  - `teams/` - Team listing with event filter
  - `teams/[id]/` - Team detail with players and bulk player creation
  - `teams/[id]/players` - Manage team players
  - `users/` - User management page with filters and actions
  - `activity/` - Sports and games activity management
  - `fixtures/` - Fixture management with knockout/round-robin tournaments
  - `fixtures/create` - Create new fixtures with participant selection
  - `fixtures/[id]/` - Fixture detail page with bracket/match visualization and print functionality
  - `fixtures/[id]/standings` - Standings page for round-robin fixtures
  - `players/`, `reports/`, `settings/` - Feature pages
- `frontend/src/components/` - React components (AuthGuard, Header)
- `frontend/src/store/` - Redux store and auth slice
- `frontend/src/providers/` - MSAL and Redux providers
- `frontend/src/hooks/` - Custom hooks (useAuth)
- `frontend/src/config/` - MSAL configuration
- `frontend/src/utils/` - Utilities (getImageUrl for handling uploads)
- `frontend/middleware.ts` - Next.js middleware for route protection
- `frontend/next.config.ts` - Next.js configuration with image domains
- `frontend/app/globals.css` - Global styles including print media queries

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
  // Virtual fields: isOngoing, hasEnded, isUpcoming, status
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

#### SportGame Model
```typescript
{
  title: string
  type: 'sport' | 'game'
  category: string
  description?: string
  rules?: string
  minPlayers: number
  maxPlayers: number
  equipment?: string[]
  duration?: number
  isDoubles?: boolean // For doubles tournaments
  createdBy: ObjectId (User)
  isActive: boolean
}
```

#### Fixture Model
```typescript
{
  name: string
  description?: string
  eventId: ObjectId (Event)
  sportGameId: ObjectId (SportGame)
  format: 'knockout' | 'roundrobin'
  participantType: 'player' | 'team'
  participants: [ObjectId] // Array of player IDs or team IDs
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  startDate?: Date  // Now optional
  endDate?: Date
  settings: {
    // Knockout specific
    thirdPlaceMatch?: boolean
    randomizeSeeds?: boolean
    avoidSameTeamFirstRound?: boolean
    // Round-robin specific
    rounds?: number
    homeAndAway?: boolean
    // Common settings
    matchDuration?: number
    venue?: string
    pointsForWin?: number
    pointsForDraw?: number
    pointsForLoss?: number
  }
  createdBy: ObjectId (User)
  isActive: boolean
}
```

#### Match Model
```typescript
{
  fixtureId: ObjectId (Fixture)
  round: number
  matchNumber: number
  homeParticipant?: ObjectId // Player or Team ID
  awayParticipant?: ObjectId // Player or Team ID
  homePartner?: ObjectId // For doubles matches
  awayPartner?: ObjectId // For doubles matches
  homeScore?: number
  awayScore?: number
  winner?: ObjectId
  winnerPartner?: ObjectId // For doubles matches
  loser?: ObjectId
  loserPartner?: ObjectId // For doubles matches
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed' | 'walkover'
  scheduledDate?: Date
  actualDate?: Date
  venue?: string
  duration?: number
  // Knockout specific
  nextMatchId?: ObjectId
  previousMatchIds?: [ObjectId]
  isThirdPlaceMatch?: boolean
  // Match details
  notes?: string
  scoreDetails?: {
    periods?: Array
    overtime?: boolean
    penaltyShootout?: object
  }
}
```

### Technical Implementation Details

#### Fixture System Architecture

1. **Same-Team Match Avoidance Algorithm**:
   - `arrangeParticipantsAvoidSameTeam()` function in `fixtures.ts`
   - Groups players by team and creates optimal pairings
   - Validates if perfect avoidance is mathematically possible
   - Falls back to best-effort arrangement when perfect avoidance impossible
   - Post-creation validation ensures no same-team matches in round 1

2. **Knockout Bracket Generation**:
   - Calculates bracket size as next power of 2: `Math.pow(2, Math.ceil(Math.log2(totalParticipants)))`
   - Determines bye count: `bracketSize - totalParticipants`
   - First round only creates matches for participants without byes
   - Bye participants automatically advance to round 2
   - Proper match linking ensures correct tournament progression
   - Handles walkovers when a match has only one participant

3. **Team Name Display in Brackets**:
   - Frontend fetches teams via `/api/teams?eventId={id}`
   - Creates `teamMap: Map<teamId, teamName>` for efficient lookups
   - `getPlayerTeamName()` helper function resolves team names
   - Team names displayed in italic gray text below player names

4. **Fixture Settings**:
   - `randomizeSeeds`: Shuffles participant order (default: true)
   - `avoidSameTeamFirstRound`: Prevents same-team matches (default: true)
   - `thirdPlaceMatch`: Adds 3rd place match for knockouts
   - Settings passed in fixture creation request body

5. **Tournament Bracket Structure**:
   - Bracket size = 2^(ceil(log2(participants))) for balanced tree
   - Bye count = bracketSize - totalParticipants
   - First round matches = (totalParticipants - byes) / 2
   - Players with byes skip round 1 and enter in round 2
   - Total rounds = ceil(log2(bracketSize))
   - Example: 10 players → 16 bracket size → 6 byes → 2 first round matches
   - Bye matches properly labeled as "Bye Match" instead of "scheduled"
   - Non-interactive bye match cards (no hover/click functionality)

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
   - Bulk player creation with "Name <email>" format
   - Filter teams by event
   - Captain and vice-captain cannot be the same person
   - Automatic addition of captain/vice-captain to players list
   - Searchable dropdown for captain/vice-captain selection

3. **Sports & Games Activity Management**
   - Create and manage sports/games activities
   - Categorize by type (sport or game)
   - Define rules, equipment, player limits, and duration
   - Admin and super admin access only
   - Activity library for fixture creation

4. **Fixture Management System**
   - Create knockout and round-robin tournaments
   - Support for both player and team fixtures
   - Automatic bracket generation for knockout tournaments
   - Round-robin schedule generation with configurable rounds
   - Settings to avoid same-team matchups in first round
   - Match result recording and winner progression
   - Standings calculation for round-robin fixtures
   - Fixture filtering by event, format, and status
   - Proper bye match handling with "Bye Match" labels
   - Non-interactive bye matches (no hover/click)

5. **Dashboard with Real-Time Statistics**
   - Total counts for events, teams, users, and fixtures
   - Active/upcoming events display
   - Role-based quick actions
   - Recent activity overview
   - Visual statistics cards with icons

6. **Role-Based Access Control**
   - Super Admin: Full system access, user management, permissions configuration
   - Admin: Create/manage events, teams, and fixtures
   - Captain: Manage own team and players, create fixtures
   - Vice Captain: Same permissions as Captain
   - Player: View team and event information

7. **User Management System** (Super Admin only)
   - View all users with search and role filters
   - Create new users manually with Add User button
   - Edit user roles and status (active/inactive)
   - Delete users (except super admins who are protected)
   - Toggle user active status
   - User statistics and last login tracking

8. **Enhanced UI Components**
   - Header with logo, navigation menu, user info, and logout
   - User dropdown menu with profile and settings links
   - Dashboard with statistics cards and quick actions
   - Profile page with Overview, Team Info, and Activity Log tabs
   - Responsive design with mobile menu support
   - Image preview for uploads with Next.js Image component
   - Searchable dropdowns for user selection
   - Sortable table columns
   - Loading states and error handling
   - Filter panels for lists
   - Tournament bracket with connecting lines and visual progression
   - Interactive match cards with hover effects
   - Winner path highlighting in tournament brackets
   - Connection dots for visual clarity in brackets
   - Print button for tournament brackets (knockout fixtures only)
   - Print-optimized layout with A4 landscape support

9. **Logging System**
   - All actions logged to files in `backend/logs/`
   - Audit trail stored in MongoDB with proper schema
   - Winston logger with rotation
   - Tracks user actions: create, update, delete, login, logout
   - Request logging with duration and status codes

10. **Authentication**
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
- `POST /api/auth/login` - Local authentication
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
  - Returns: counts for events, teams, users, fixtures, and role-specific data

### Events
- `GET /api/events` - Get all events with filters
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
- `POST /api/teams/:id/players/bulk` - Bulk create and add players
  - Body: `{ players: ["Name1 <email1>", "Name2 <email2>"] }`
- `DELETE /api/teams/:id/players/:playerId` - Remove player from team

### Users
- `GET /api/users` - Get all users with role filter support
- `POST /api/users` - Create new user
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user (including role and status)
- `DELETE /api/users/:id` - Delete user (Super Admin only)
- `GET /api/users/stats` - Get user statistics

### Sports & Games
- `GET /api/sportgames` - Get all activities
- `POST /api/sportgames` - Create new activity (Admin only)
- `GET /api/sportgames/:id` - Get activity details
- `PUT /api/sportgames/:id` - Update activity (Admin only)
- `DELETE /api/sportgames/:id` - Soft delete activity (Admin only)

### Fixtures
- `GET /api/fixtures` - Get all fixtures with filters
  - Query: `?eventId=xxx&format=knockout&status=scheduled`
- `POST /api/fixtures` - Create new fixture with auto-match generation
  - Body: includes format, participants, settings
- `GET /api/fixtures/:id` - Get fixture with matches and participants
- `PUT /api/fixtures/:fixtureId/matches/:matchId` - Update match result
- `PUT /api/fixtures/:fixtureId/matches/:matchId/participants` - Update match participants (Super Admin only)
  - Body: `{ homeParticipant: ObjectId, awayParticipant: ObjectId }`
- `GET /api/fixtures/:id/standings` - Get standings for round-robin
- `DELETE /api/fixtures/:id` - Soft delete fixture

### Permissions (Super Admin only)
- `GET /api/permissions` - Get all permissions
- `GET /api/permissions/:role` - Get permissions for a role
- `PUT /api/permissions/:role` - Update role permissions
- `POST /api/permissions/check` - Check user permission

## Important Conventions

1. **Next.js 15 Compatibility** - Use `React.use()` for async params in page components
2. **TypeScript** - Both frontend and backend use TypeScript strictly
3. **Environment Variables** - Copy `.env.example` files to `.env` files before running
4. **Git Commits** - Push to https://github.com/mudakara/fixture.git
5. **Security** - Never commit `.env` files or expose secrets
6. **Logging** - Use the logger utility for all backend logging
7. **Error Handling** - All errors should be logged and returned with appropriate HTTP status codes
8. **Ports** - Frontend runs on port 3500, Backend API runs on port 3501
9. **CORS** - Backend configured to accept requests only from http://localhost:3500
10. **Authentication Flow** - Users login via Microsoft → Backend validates token → Creates/updates user → Returns JWT
11. **Role Naming** - Roles use underscores (super_admin, vice_captain) in database
12. **File Uploads** - Multer handles image uploads for events and teams, stored in backend/uploads/
13. **Data Relationships** - Events → Teams → Players (Users) hierarchy with MongoDB references
14. **Soft Deletes** - Events, teams, and fixtures use isActive flag instead of hard deletion
15. **Image Formats** - Supported: JPEG, JPG, PNG, GIF, WebP (5MB max)
16. **Date Validation** - Event end date must be after or equal to start date
17. **Bulk Operations** - Support comma-separated values for bulk player creation
18. **Dynamic Routes** - Use consistent naming ([id] or [eventId]) to avoid conflicts
19. **Fixture Creation** - Supports `avoidSameTeamFirstRound` setting to prevent same-team matches
20. **Team Population** - Frontend fetches teams separately when teamId is not populated in responses
21. **Match Generation** - Knockout brackets use proper tournament structure with bye handling
22. **Bracket Size Calculation** - Uses next power of 2 to ensure balanced tournament tree

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
7. **AuditLog Validation**: Use correct action enum values (create, update, delete, login, logout)
8. **File Upload Errors**: Ensure backend/uploads directory exists with write permissions
9. **Image Not Loading**: Configure Next.js remotePatterns for localhost:3501
10. **Team Creation Fails**: Verify captain and vice-captain are different users
11. **Next.js 15 Async Params**: Use React.use() to unwrap Promise params
12. **Dynamic Route Conflicts**: Ensure consistent folder naming in app directory
13. **Dropdown Not Closing**: Implement proper onBlur handlers with setTimeout
14. **404 After Navigation**: Use correct route paths with template literals
15. **Bulk Player Creation**: Parse "Name <email>" format correctly
16. **Fixture Routes 404**: Ensure routes are mounted correctly (e.g., `/api/fixtures` not `/api` + `/fixtures`)
17. **Tournament Bracket Logic**: Round 1 should have the most matches, decreasing towards the final
18. **Team Names Not Showing in Brackets**: Frontend creates a teamMap by fetching teams separately
19. **Same-Team Match Prevention**: Use `avoidSameTeamFirstRound` setting in fixture creation
20. **Empty Matches in Knockout**: First round creates matches only for non-bye participants
21. **Bye Handling in Tournaments**: Players with byes advance directly to round 2
22. **CSS Parsing Errors**: Avoid escaped class selectors in print styles (use attribute selectors)
23. **Print Styles Not Applying**: Use dangerouslySetInnerHTML for inline styles or global CSS
24. **Browser Print Preview Issues**: Add delay before window.print() to ensure styles load
25. **Bye Matches Showing as "Scheduled"**: Check for single participant and display "Bye Match" label

## Recent Updates

### v0.10 Updates (Latest)
- **Drag-and-Drop Fixture Editing for Super Admins**:
  - Added "Edit Fixture" button for super admins on player knockout tournaments
  - Implemented drag-and-drop functionality using @dnd-kit library
  - Features:
    - Visual edit mode with orange border and "Editable" badges
    - Drag players between match positions to rearrange brackets
    - Empty slots show "Drop player here" placeholder
    - Real-time database updates on drop
    - Automatic clearing of scores/winner when participants change
  - Technical implementation:
    - Created `EditableKnockoutBracket` component with DndContext
    - Uses @dnd-kit/core, @dnd-kit/sortable, and @dnd-kit/utilities
    - Dynamic import with Next.js to avoid SSR issues
    - New API endpoint: `PUT /api/fixtures/:fixtureId/matches/:matchId/participants`
  - Security:
    - Only super admins can access edit mode
    - Role validation in both frontend and backend
    - AuditLog tracks all participant changes
  - Bug fixes:
    - Fixed AuditLog validation error (entity vs resource, entityId vs resourceId)
    - Corrected user ID reference (user._id vs user.userId)
    - Fixed TypeScript null vs undefined issues

### v0.9 Updates
- **Bye Match Label Fix for Odd Number of Participants**:
  - Fixed issue where bye matches in round 2 showed "scheduled" instead of "Bye"
  - Added detection logic for bye matches: `(match.homeParticipant && !match.awayParticipant) || (!match.homeParticipant && match.awayParticipant)`
  - Status badge now displays "Bye Match" for matches with only one participant
  - Disabled click interactions on bye matches (no hover effects, no update modal)
  - Works for bye matches in any round, not just round 2
  - Provides clearer UI indication that these matches don't require any action

### v0.8 Updates
- **Print Functionality for Tournament Brackets**:
  - Added print button for knockout tournament brackets
  - Implemented comprehensive print styles using multiple approaches:
    - Inline styles with `dangerouslySetInnerHTML` in the fixture detail page
    - Global print media queries in `app/globals.css`
    - Multiple print-specific CSS files created during implementation
  - Print features include:
    - A4 landscape orientation with 10mm margins
    - Hidden navigation elements, buttons, and UI controls during print
    - Print-specific header showing fixture name, event, and date
    - Tournament bracket scaling (0.85x default, 0.7x for large tournaments)
    - Black and white color scheme for better print quality
    - Grayscale winner highlighting and champion cards
    - Connection lines preserved in print view
    - Page break handling for multi-page tournaments
  - Technical implementation:
    - Added `printing-bracket` class to body during print operation
    - Used CSS attribute selectors to avoid escaped class selector issues
    - Force color printing with `-webkit-print-color-adjust: exact`
    - Visibility and opacity overrides to ensure content displays
  - Known limitations:
    - Print functionality may require browser-specific adjustments
    - Some browsers may not fully respect print media queries
    - Complex bracket layouts may need manual scaling adjustments

### v0.7 Updates
- **Doubles Tournament Support**:
  - Added doubles support for player fixtures in sports/games
  - Backend modifications:
    - Added `isDoubles` boolean field to SportGame model
    - Added partner fields to Match model: `homePartner`, `awayPartner`, `winnerPartner`, `loserPartner`
    - Modified fixture details API to return all event players for doubles fixtures
    - Added `/api/fixtures/:fixtureId/matches/:matchId/partners` endpoint for updating partners
  - Frontend enhancements:
    - Partner selection dropdowns in match update modal
    - "Add Partner" buttons displayed on match cards when partners not assigned
    - Intelligent partner availability logic:
      - Only shows players from the same team as available partners
      - Excludes players already participating in other matches
      - Handles partner updates and reassignments
    - Enhanced match card layout to display doubles pairs
    - Increased match card height for doubles fixtures (170px)
  - Partner selection algorithm:
    - Validates team membership for current event
    - Prevents selecting players already in the fixture
    - Allows editing existing partner assignments
    - Maintains team cohesion in doubles pairings

### v0.6 Updates
- **Dynamic Match Results and Advanced Partner Logic**:
  - Enhanced tournament advancement based on actual match results
  - Added dynamic result checking with `determineAdvancingParticipant()` function
  - Improved doubles partner selection algorithm:
    - Uses `allEventPlayers` for comprehensive partner pool
    - Validates partners are from same team as primary participant
    - Excludes players already participating in any match
    - Allows reassignment of partners during match updates
  - Fixed partner selection dropdown showing "No available partners"
  - Backend properly returns all team players for partner selection
  - Winner determination respects completed match results over walkovers

### v0.5 Updates
- **Enhanced Knockout Bracket Generation with Proper Bye Handling**:
  - Implemented proper tournament bracket structure following standard conventions
  - Calculates bracket size as next power of 2 to accommodate all participants
  - Players receiving byes advance directly to round 2 (standard tournament format)
  - First round only creates matches for non-bye participants
  - Bye participants are automatically placed in round 2 matches
  - Improved logging shows bracket structure details (byes, matches per round, etc.)
  - Ensures balanced tournament tree with proper advancement paths

### v0.4 Updates
- **Advanced Same-Team Match Avoidance for Player Fixtures**:
  - Implemented intelligent algorithm to prevent players from same team facing each other in round 1
  - Pre-creation validation checks if same-team avoidance is mathematically possible
  - Arranges participants optimally to minimize same-team matchups
  - Supports randomization while maintaining team separation
  - Provides warnings when perfect avoidance is impossible (e.g., team has >50% of players)
  - Validates all matches after creation to ensure no same-team pairings
  - Works for both knockout and round-robin formats

- **Team Name Display in Player Brackets**:
  - Fixed team names not showing under player names in tournament brackets
  - Frontend now fetches team data separately and creates a teamMap for lookups
  - Team names appear in italic gray text below player names
  - Backend properly attaches team information during match population
  - Only shows teams from the current event

- **Fixture Details Error Fix**:
  - Resolved "Failed to fetch fixture details" error
  - Simplified complex nested population queries that were causing issues
  - Improved error handling with detailed error messages
  - Fixed TypeScript compilation errors

### v0.3 Updates
- **Fixture Date Fields Made Optional**:
  - Both `startDate` and `endDate` are now optional for fixtures
  - Removed required validation from fixture creation API
  - Updated fixture creation form to remove required asterisk
  - Allows more flexibility in tournament planning

- **Improved Knockout Bracket Generation**:
  - Fixed issue where empty matches (TBD vs bye) were created in round 1
  - Bracket now only creates necessary matches based on participant count
  - First round matches = ceil(participants / 2) instead of full power of 2
  - Properly handles bye rounds with walkover advancement
  - Match linking algorithm updated to handle variable first round sizes
  - No more empty match cards in the tournament bracket view

### v0.2 Updates
- **Randomize Bracket Feature**:
  - Added "Randomize Bracket" button for super admins on knockout fixtures
  - Only available for team-based knockout tournaments before any matches are played
  - Creates new random pairings with proper Fisher-Yates shuffle algorithm
  - API endpoint validates permissions and fixture state before randomizing
  - Audit log tracks randomization actions
  - Purple button with refresh icon in tournament bracket header

- **Team Names in Player Brackets**:
  - Player fixtures now show team names below player names in brackets
  - Backend populates team memberships for the specific event
  - Match cards display format: Player Name / (Team Name) in smaller gray text
  - Increased player fixture card height to 150px to accommodate team info
  - Only shows teams from the current event

- **Bug Fixes**:
  - Fixed "Cannot read properties of undefined (reading 'length')" error in Team model
  - Added safety checks for undefined players array in Team virtual fields and methods
  - Fixed fixture details API to properly handle team/player population
  - Resolved TypeScript compilation errors with unused variables
  - Fixed draft badge still showing on fixture cards

- **Performance Improvements**:
  - Added debouncing to fixture page filters (300ms delay)
  - Better error handling for rate limit (429) errors
  - Improved loading states to prevent duplicate requests
  - Clear user-friendly messages for rate limit errors

- **Edit Pages Created**:
  - Created sport/game edit page at `/sportgames/[id]/edit`
  - Created team edit page at `/teams/[id]/edit`
  - Both pages support image upload/update functionality
  - Role-based access control (admins can edit all fields, captains limited)

- **API Additions**:
  - `POST /api/fixtures/:id/randomize` - Randomize knockout bracket (Super Admin only)

### v0.1 Updates
- **Enhanced Tournament Bracket Visualization**:
  - Added connecting lines between matches using CSS-based divs
  - Lines properly connect from center of each match card to the next round
  - Winner paths highlighted in green (#10b981)
  - Added connection dots at line endpoints for clarity
  - Finals winner gets special "Champion" badge with trophy icon
  - Champion match card has golden border and background
  - Match card heights: 150px for players (with teams), 125px for team fixtures
  - Card width set to 300px with proper name truncation
  - Added tooltips for long participant names

### Bug Fixes and Improvements
- **Fixed Team Selection Bug in Fixtures**: Teams are now loaded upfront and filtered client-side
- **Fixed Fixture Routes 404 Error**: Corrected API endpoint routing configuration
- **Created Fixture Detail Pages**: Added `/fixtures/[id]` and `/fixtures/[id]/standings` pages
- **Improved UX on Fixture Detail Page**: Made all text darker and more readable
- **Fixed Tournament Bracket Generation**: 
  - Corrected round numbering (now starts from Round 1)
  - Fixed match linking algorithm for proper tournament tree structure
  - Added automatic advancement for walkover matches
  - Winners now properly advance to the correct position in next round

### Fixture Management System
- Created Fixture and Match models for tournament management
- Implemented knockout bracket generation with seeding options
- Added round-robin schedule generation with configurable rounds
- Created fixture list page with filtering capabilities
- Built fixture creation form with participant selection
- Added match result recording functionality
- Implemented standings calculation for round-robin tournaments
- Support for both player and team fixtures
- Interactive tournament bracket visualization
- Match update modal for recording results

### Dashboard Enhancement
- Replaced placeholder dashboard with real-time statistics
- Added role-based quick actions and navigation
- Implemented statistics API endpoint
- Added visual cards with icons for better UX

### Sports & Games Activity Module
- Created SportGame model for activity management
- Built activity management pages (list, create, edit)
- Added admin-only access control
- Renamed menu from "Sports & Games" to "Activity"

### Bulk Player Management
- Added bulk player creation functionality
- Support for "Name <email>" format parsing
- Automatic user creation with player role
- Team association during bulk creation

### Next.js 15 Compatibility
- Fixed async params warning with React.use()
- Updated all dynamic routes to handle Promise params
- Resolved image loading configuration issues

### UI/UX Improvements
- Fixed dropdown closing behavior in team creation
- Added proper navigation after entity creation
- Implemented comprehensive error handling
- Created user management page with filters
- Enhanced text readability across fixture pages

### Previous Updates
- Event-Team-Player Architecture implementation
- User Management System with role editing
- Enhanced UI components and responsive design
- Permission System with visual matrix
- Authentication flow improvements