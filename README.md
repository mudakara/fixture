# MatchMaker Pro

A comprehensive sports fixture management system with role-based access control.

## Features

- **Role-Based Access Control**: Super Admin, Admin, Captain, and Player roles
- **Team Management**: Create and manage sports teams
- **Fixture Scheduling**: Schedule and track matches
- **Audit Logging**: Complete event logging and transaction tracking
- **Modern Tech Stack**: Next.js, React, Node.js, Express, MongoDB

## Quick Start

1. Clone the repository
2. Install dependencies: `npm run install:all`
3. Set up environment variables:
   - Copy `backend/.env.example` to `backend/.env`
   - Copy `frontend/.env.local.example` to `frontend/.env.local`
   - Update MongoDB URI and Azure AD settings
4. Run development servers: `npm run dev`
   - Frontend: http://localhost:3500
   - Backend: http://localhost:3501

## Development Commands

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run lint` - Run linting for both frontend and backend
- `npm run test` - Run tests for both frontend and backend

## Default Credentials

- Email: admin@matchmakerpro.com
- Password: changethispassword
- **Important**: Change these credentials immediately after first login

## Architecture

- **Frontend**: Next.js 14 with TypeScript, Redux Toolkit, Tailwind CSS
- **Backend**: Node.js with Express, TypeScript, MongoDB
- **Authentication**: JWT with httpOnly cookies
- **Logging**: Winston with file rotation
- **Security**: Helmet, CORS, Rate limiting
