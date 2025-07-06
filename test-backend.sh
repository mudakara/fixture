#!/bin/bash

echo "Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!

echo "Waiting for server to start..."
sleep 5

echo "Testing health endpoint..."
curl -s http://localhost:3501/health | jq .

echo "Server is running with PID: $BACKEND_PID"
echo "To stop the server, run: kill $BACKEND_PID"