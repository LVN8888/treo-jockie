@echo off
setlocal EnableExtensions EnableDelayedExpansion

:: Set console title
title TREO JOCKIE TOOL

set "CONFIG_DIR=%~dp0configs"

:: --- Child Process Route ---
if not "%~1"=="" goto IGNITION

:: --- Master Controller Route ---
echo ==================================================
echo                  TREO JOCKIE TOOL
echo ==================================================
echo [SYS] Scanning target directory: "%CONFIG_DIR%"

if not exist "%CONFIG_DIR%\" (
  echo [ERR] Critical failure: Directory not found.
  pause
  exit /b 1
)

echo [SYS] Background monitoring started. Press Ctrl+C to abort all.
echo =======================================================
echo.

:: --- Quét và theo dõi file mới liên tục ---
:MONITOR_LOOP
for %%f in ("%CONFIG_DIR%\*.env") do (
  :: Kiểm tra xem biến DEPLOYED_tênfile đã tồn tại chưa
  if not defined DEPLOYED_%%~nxf (
    :: Đánh dấu là đã chạy để lần quét sau không bị trùng
    set "DEPLOYED_%%~nxf=1"
    
    echo [SYS] %time:~0,8% - Detected payload: "%%~nxf"
    echo [AWT] Deploying instance: "%%~nxf"
    
    :: Chạy ngầm tiến trình con
    start /B "" cmd /c ""%~f0" "%%~ff""
  )
)

:: Delay 10 giây trước khi quét lại để không làm tốn CPU
timeout /t 10 /nobreak >nul
goto MONITOR_LOOP


:: --- Ignition Sequence (Child Process) ---
:IGNITION
set "CONFIG=%~1"
set "INSTANCE_ID=%~nx1"

:REBOOT_LOOP
echo [INI :: %INSTANCE_ID%] %time:~0,8% - Initializing sequence...

:: Thêm --max-old-space-size=150 để ép Node.js dọn rác sớm, tối ưu RAM cực tốt cho việc treo nhiều acc
node --max-old-space-size=150 "%~dp0index.js" --configs "%CONFIG%"
set "EXIT_CODE=%ERRORLEVEL%"

echo [DWN :: %INSTANCE_ID%] %time:~0,8% - Process terminated (Code: !EXIT_CODE!). Rebooting in 5s...
timeout /t 5 /nobreak >nul
goto REBOOT_LOOP