@echo off
setlocal
cd /d "%~dp0"
echo 正在停止 ARKS 服务...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Stop.ps1"
if errorlevel 1 (
  echo 停止失败，请查看上面的提示。
  pause
  exit /b 1
)
echo 正在启动 ARKS 服务...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start.ps1"
if errorlevel 1 (
  echo 启动失败，请查看 data\server.stderr.log。
  pause
  exit /b 1
)
echo 重启完成，浏览器应已打开 http://127.0.0.1:8765
endlocal
