@echo off
REM HireLens Production Build Script (Windows)

SETLOCAL ENABLEDELAYEDEXPANSION

echo 🏗️ Building HireLens for Production...

REM Clean previous builds
echo 🧹 Cleaning previous builds...
npm run clean

REM Install Node.js dependencies
echo 📦 Installing dependencies...
npm install

REM Build shared packages
echo 🔨 Building shared packages...
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/config

REM Build Next.js client
echo ⚛️ Building Next.js client...
cd client
npm run build
cd ..

REM Install Python dependencies for server
echo 🐍 Installing Python dependencies...
cd server
pip install -r requirements.txt
cd ..

echo ✅ Production build completed!
echo 📁 Client build: client\.next
echo 🐍 Server ready: server
echo 🚀 Ready for deployment!
pause
