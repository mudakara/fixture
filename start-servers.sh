#!/bin/bash

echo "Starting MatchMaker Pro servers..."

# Start backend
echo "Starting backend on port 3501..."
cd backend && npm run dev &

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "Starting frontend on port 3500..."
cd ../frontend && npm run dev &

echo ""
echo "Servers are starting..."
echo "Backend: http://localhost:3501"
echo "Frontend: http://localhost:3500"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for Ctrl+C
wait