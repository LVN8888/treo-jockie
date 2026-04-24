@echo off
setlocal EnableExtensions EnableDelayedExpansion

title TREO JOCKIE TOOL
set "CONFIG_DIR=%~dp0configs"

:: --- Child Process Route ---
if /i "%~1"=="--child" goto IGNITION

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

:MONITOR_LOOP

:: Start new .env instances
for %%f in ("%CONFIG_DIR%\*.env") do (
  if exist "%%~ff" (
    if not defined DEPLOYED_%%~nxf (
      set "DEPLOYED_%%~nxf=1"
      echo [SYS] %time:~0,8% - Detected payload: "%%~nxf"
      echo [AWT] Deploying instance: "%%~nxf"

      powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c call ""%~f0"" --child ""%%~ff""' -WindowStyle Hidden -PassThru; Write-Output $p.Id" > "%TEMP%\treo_pid_%%~nxf.txt"

      set /p "PID_%%~nxf="<"%TEMP%\treo_pid_%%~nxf.txt"
      echo [PID] %%~nxf = !PID_%%~nxf!
    )
  )
)

:: Stop removed/renamed .env instances
for /f "tokens=1* delims==" %%A in ('set DEPLOYED_ 2^>nul') do (
  set "VAR_NAME=%%A"
  set "FILE_NAME=!VAR_NAME:DEPLOYED_=!"

  if not exist "%CONFIG_DIR%\!FILE_NAME!" (
    echo [SYS] %time:~0,8% - Detected !FILE_NAME! has been deleted/renamed!
    echo [STP] Automatically stopping bot for !FILE_NAME!...

    set "TARGET_PID=!PID_!FILE_NAME!!"

    if defined TARGET_PID (
      taskkill /F /T /PID !TARGET_PID! >nul 2>&1
      echo [STP] Stopped PID !TARGET_PID! for !FILE_NAME!.
      set "PID_!FILE_NAME!="
      del "%TEMP%\treo_pid_!FILE_NAME!.txt" >nul 2>&1
    ) else (
      echo [WRN] No PID found for !FILE_NAME!.
    )

    set "DEPLOYED_!FILE_NAME!="
  )
)

timeout /t 3 /nobreak >nul
goto MONITOR_LOOP


:IGNITION
set "CONFIG=%~2"
set "INSTANCE_ID=%~nx2"

echo [DBG] Child started for "%INSTANCE_ID%"
echo [DBG] CONFIG = "%CONFIG%"

:REBOOT_LOOP
if not exist "%CONFIG%" (
  echo [DWN :: %INSTANCE_ID%] %time:~0,8% - Process terminated safely.
  exit /b 0
)

echo [INI :: %INSTANCE_ID%] %time:~0,8% - Initializing sequence...
node --max-old-space-size=150 "%~dp0index.js" --configs "%CONFIG%"
set "EXIT_CODE=%ERRORLEVEL%"

if not exist "%CONFIG%" (
  echo [DWN :: %INSTANCE_ID%] %time:~0,8% - Config removed. Not rebooting.
  exit /b 0
)

echo [DWN :: %INSTANCE_ID%] %time:~0,8% - Process terminated Code: !EXIT_CODE!. Rebooting in 5s...
timeout /t 5 /nobreak >nul
goto REBOOT_LOOP