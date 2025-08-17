@echo off
echo Starting Firebase Emulators...
echo.

REM Clean start - remove any existing data
if exist .firebase\emulators rmdir /s /q .firebase\emulators

REM Start emulators
start "Firebase Emulators" firebase emulators:start

REM Wait for emulators to start
timeout /t 5

REM Seed data
echo.
echo Seeding data...
node firestore-seed.js

echo.
echo Setup complete! 
echo - Firestore UI: http://localhost:4000
echo - Your app should connect to the emulators automatically
echo.
pause
