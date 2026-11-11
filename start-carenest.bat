@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo CareNest needs Node.js 22.13 or later.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)
echo Starting CareNest Clinic demo.
echo When the server is ready, open http://127.0.0.1:3000
echo Keep this window open while you use the dashboard.
echo.
node backend\server.js
pause
