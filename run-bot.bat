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

echo [SYS] System is now monitoring.
echo [SYS] - Adding .env file = Auto start account.
echo [SYS] - Renaming to .off / Moving file = Auto stop account.
echo =======================================================
echo.

:: --- Quét và theo dõi liên tục ---
:MONITOR_LOOP
:: 1. Quét tìm file .env mới để chạy
for %%f in ("%CONFIG_DIR%\*.env") do (
  if not defined DEPLOYED_%%~nxf (
    set "DEPLOYED_%%~nxf=1"
    
    echo [SYS] %time:~0,8% - Detected payload: "%%~nxf"
    echo [AWT] Deploying instance: "%%~nxf"
    start /B "" cmd /c ""%~f0" "%%~ff""
  )
)

:: 2. Quét kiểm tra các file đã chạy, nếu bị đổi tên/xóa thì TỰ ĐỘNG TẮT NODE
for /f "tokens=1* delims==" %%A in ('set DEPLOYED_ 2^>nul') do (
  :: %%A là tên biến (vd: DEPLOYED_acc1.env). Lọc lấy chữ acc1.env
  set "VAR_NAME=%%A"
  set "FILE_NAME=!VAR_NAME:DEPLOYED_=!"
  
  :: Nếu file không còn tồn tại trong folder config
  if not exist "%CONFIG_DIR%\!FILE_NAME!" (
    echo [SYS] %time:~0,8% - Detected !FILE_NAME! has been deleted/renamed!
    echo [STP] Automatically stopping bot for !FILE_NAME!...
    wmic process where "name='node.exe' and commandline like '%%!FILE_NAME!%%'" call terminate >nul 2>&1
    
    :: Xóa cờ ghi nhớ để nhỡ bạn thả file đó vào lại thì nó sẽ tự chạy lại
    set "DEPLOYED_!FILE_NAME!="
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
:: Nếu file .env không tồn tại (do bạn đổi đuôi), thoát hẳn tiến trình con (không tự mở lại nữa)
if not exist "%CONFIG%" (
  echo [DWN :: %INSTANCE_ID%] %time:~0,8% - Process terminated safely.
  exit /b 0
)

echo [INI :: %INSTANCE_ID%] %time:~0,8% - Initializing sequence...
node --max-old-space-size=150 "%~dp0index.js" --configs "%CONFIG%"
set "EXIT_CODE=%ERRORLEVEL%"

echo [DWN :: %INSTANCE_ID%] %time:~0,8% - Process terminated (Code: !EXIT_CODE!). Rebooting in 5s...
timeout /t 5 /nobreak >nul
goto REBOOT_LOOP