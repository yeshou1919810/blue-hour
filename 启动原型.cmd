@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20 or later, then try again.
  pause
  exit /b 1
)
echo Starting Blue Hour Club...
echo The browser will open after the server is ready.
echo Keep this window open. Press Ctrl+C to stop.
node server.mjs --open
if errorlevel 1 pause
