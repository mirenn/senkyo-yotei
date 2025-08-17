@echo off
REM Development setup script for Windows

echo === Election Voting Platform Setup ===

REM Check if we're in the right directory
if not exist "architecture.md" (
  echo ❌ Please run this script from the project root directory
  exit /b 1
)

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
  echo ❌ Failed to install frontend dependencies
  exit /b 1
)

echo.
echo ✅ Setup complete!
echo.
echo 🚀 To start development:
echo    cd frontend ^&^& npm run dev
echo.
echo 📖 The app will run in demo mode with mock data.
echo    To enable Firebase integration, update frontend/src/firebase/config.ts
echo.
echo 🔍 Check README.md for detailed setup instructions
