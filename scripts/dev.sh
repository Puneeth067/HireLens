#!/bin/bash

# HireLens Development Startup Script

set -e

echo "🚀 Starting HireLens Development Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python >= 3.8"
    exit 1
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Build shared packages
echo "🔨 Building shared packages..."
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/config

# Start development servers in parallel
echo "🌟 Starting development servers..."

# Function to handle cleanup
cleanup() {
    echo "\n🛑 Shutting down development servers..."
    jobs -p | xargs -r kill
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend server
echo "🐍 Starting FastAPI server on http://localhost:8000"
cd server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
SERVER_PID=$!
cd ..

# Wait a moment for server to start
sleep 2

# Start frontend server
echo "⚛️  Starting Next.js client on http://localhost:3000"
cd client
npm run dev &
CLIENT_PID=$!
cd ..

echo "✅ Development environment is ready!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔗 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo "\n💡 Press Ctrl+C to stop all servers"

# Wait for background processes
wait
