#!/bin/bash

echo "Checking backend setup..."

# Check if .env exists
if [ ! -f backend/.env ]; then
    echo "❌ backend/.env file not found!"
    echo "Creating from example..."
    cp backend/.env.example backend/.env
else
    echo "✅ backend/.env exists"
fi

# Check MongoDB
echo ""
echo "Checking MongoDB connection..."
if mongosh --eval "db.version()" > /dev/null 2>&1; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB is not running. Please start MongoDB first:"
    echo "   brew services start mongodb-community"
    echo "   or"
    echo "   mongod"
fi

# Check ports
echo ""
echo "Checking ports..."
if lsof -i :3501 | grep LISTEN > /dev/null 2>&1; then
    echo "⚠️  Port 3501 is already in use. Killing existing process..."
    lsof -ti:3501 | xargs kill -9 2>/dev/null
fi
echo "✅ Port 3501 is available"

# Start backend
echo ""
echo "Starting backend..."
cd backend && npm run dev