@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org then try again.
  pause
  exit /b 1
)
echo Open your browser on this computer using port 3000.
echo For your phone, use this computer's IPv4 address with port 3000.
echo The private office password will appear below. Keep this window open.
node server.js
pause
