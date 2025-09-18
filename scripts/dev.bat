@echo off
REM HireLens Development Startup Script (Windows)

SETLOCAL ENABLEDELAYEDEXPANSION

echo 🚀 Starting HireLens Development Environment...

REM Check Node.js
where node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js >= 18
    exit /b 1
)

REM Check Python
where python >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo ❌ Python is not installed. Please install Python >= 3.8
    exit /b 1
)

REM Install Node.js dependencies
echo 📦 Installing Node.js dependencies...
npm install

REM Build shared packages
echo 🔨 Building shared packages...
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/config

REM Start backend server
echo 🐍 Starting FastAPI server on http://localhost:8000
start "FastAPI Server" cmd /k "cd server && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

REM Give backend a few seconds to start
timeout /t 3 /nobreak >nul

REM Start frontend server
echo ⚛️  Starting Next.js client on http://localhost:3000
start "Next.js Client" cmd /k "cd client && npm run dev"

echo ✅ Development environment is ready!
echo 🌐 Frontend: http://localhost:3000
echo 🔗 Backend API: http://localhost:8000
echo 📚 API Docs: http://localhost:8000/docs
echo 💡 Close these windows to stop the servers

pause
