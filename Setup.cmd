@echo off
setlocal
cd /d "%~dp0"
echo Preparing the local environment. First run can take several minutes...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup.ps1" %*
if errorlevel 1 (
  echo Environment setup failed. Please read the message above.
  pause
  exit /b 1
)
echo Setup finished. Double-click Start.cmd to open the workspace.
endlocal
