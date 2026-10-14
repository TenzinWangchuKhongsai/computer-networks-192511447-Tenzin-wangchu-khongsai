@echo off
setlocal
title Smart Office IoT Platform
echo Starting Smart Office IoT Control Platform...
echo.
echo Backend will run on port 3001
echo Frontend will run on port 5173
echo.
cd backend
start SmartOffice-Backend node src\server.js
cd ..
timeout /t 4 /nobreak
cd frontend
start SmartOffice-Frontend npx vite --host 0.0.0.0 --port 5173
cd ..
timeout /t 5 /nobreak
echo Opening browser...
start http://localhost:5173
echo.
echo Services running. Close the minimized windows when done.
pause
