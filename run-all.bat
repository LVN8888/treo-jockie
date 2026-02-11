@echo off
TITLE Discord Bot Multi-Config Loader
SET CONFIG_DIR=configs

echo [INFO] Searching for configuration files in %CONFIG_DIR%...
echo.

:: Loop through all .env files in the configs folder
for %%f in (%CONFIG_DIR%\*.env) do (
    echo [LAUNCH] Starting bot with config: %%f
    :: Use 'start' to run each one in a new window
    :: We use the --configs flag we implemented earlier
    start "Bot: %%f" node index.js --configs "%%f"
)

echo.
echo [SUCCESS] All bots are launching in separate windows.
pause