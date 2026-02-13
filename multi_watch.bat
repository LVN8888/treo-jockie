@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Discord Bot Multi-Config Watcher

set "CONFIG_DIR=%~dp0configs"

:: --- If called with a config path, run watch mode for that one bot ---
if not "%~1"=="" goto WATCH_ONE

echo [INFO] Config folder: "%CONFIG_DIR%"
if not exist "%CONFIG_DIR%\" (
  echo [ERROR] Folder not found: "%CONFIG_DIR%"
  pause
  exit /b 1
)

echo [INFO] Searching for .env files...
echo.

set "found=0"
for %%f in ("%CONFIG_DIR%\*.env") do (
  set "found=1"
  echo [LAUNCH] Watching: "%%~ff"
  start "Bot: %%~nxf" cmd /k ""%~f0" "%%~ff""
)

if "!found!"=="0" (
  echo [WARN] No .env files found in "%CONFIG_DIR%"
)

echo.
echo [SUCCESS] All watchers launched.
pause
exit /b 0


:WATCH_ONE
set "CONFIG=%~1"
title WATCH - %~nx1

:LOOP
echo.
echo [WATCH] %date% %time% - Starting bot with config: "%CONFIG%"
node "%~dp0index.js" --configs "%CONFIG%"
set "code=%ERRORLEVEL%"

echo [DOWN ] %date% %time% - Bot stopped (exit code !code!). Restart in 5s...
timeout /t 5 /nobreak >nul
goto LOOP
