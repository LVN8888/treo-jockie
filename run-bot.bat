@echo off
setlocal EnableExtensions EnableDelayedExpansion

title TREO JOCKIE TOOL
cd /d "%~dp0"

set "BASE_DIR=%~dp0"
set "CONFIG_DIR=%BASE_DIR%configs"

if /i "%~1"=="--child" goto CHILD

cls
echo ==================================================
echo                  TREO JOCKIE TOOL
echo ==================================================
echo [SYS] Scanning target directory: "%CONFIG_DIR%"
echo.

if not exist "%CONFIG_DIR%" (
  echo [ERR] Critical failure: Directory not found.
  pause
  exit /b 1
)

echo [SYS] System is now monitoring.
echo [SYS] - Adding .env file = Auto start account.
echo [SYS] - Renaming to .off / Moving file = Auto stop account.
echo =======================================================
echo.

:LOOP

for %%f in ("%CONFIG_DIR%\*.env") do (
  if exist "%%~ff" (
    if not defined BOT_%%~nxf (
      set "BOT_%%~nxf=1"
      set "RID_%%~nxf=TREO_%%~nxf_!RANDOM!_!RANDOM!"

      echo [SYS] %time:~0,8% - Detected payload: "%%~nxf"
      echo [AWT] Deploying instance: "%%~nxf"

      call set "THIS_RID=%%RID_%%~nxf%%"
      start "" /B cmd /c call "%~f0" --child "%%~ff" "!THIS_RID!"
    )
  )
)

for /f "tokens=1* delims==" %%A in ('set BOT_ 2^>nul') do (
  set "VAR=%%A"
  set "FILE=!VAR:BOT_=!"

  if not exist "%CONFIG_DIR%\!FILE!" (
    echo [SYS] %time:~0,8% - Detected !FILE! has been deleted/renamed!
    echo [STP] Automatically stopping bot for !FILE!...

    call set "TARGET_RID=%%RID_!FILE!%%"

    if defined TARGET_RID (
      for /f "tokens=2 delims=," %%P in ('
        wmic process where "CommandLine like '%%!TARGET_RID!%%'" get ProcessId /format:csv ^| findstr /r "[0-9]"
      ') do (
        taskkill /F /T /PID %%P >nul 2>&1
      )

      echo [STP] Stopped !FILE!
    ) else (
      echo [WRN] Run ID not found for !FILE!
    )

    set "RID_!FILE!="
    set "BOT_!FILE!="
    set "TARGET_RID="
  )
)

timeout /t 3 /nobreak >nul
goto LOOP


:CHILD
set "CONFIG=%~2"
set "TREO_RUN_ID=%~3"
set "NAME=%~nx2"

:RESTART

if not exist "%CONFIG%" exit /b 0

echo [INI :: %NAME%] %time:~0,8% - Initializing sequence...

node "%BASE_DIR%index.js" --configs "%CONFIG%" --treo-run-id "%TREO_RUN_ID%"

if not exist "%CONFIG%" exit /b 0

echo [DWN :: %NAME%] %time:~0,8% - Process terminated. Rebooting in 5s...
timeout /t 5 /nobreak >nul
goto RESTART