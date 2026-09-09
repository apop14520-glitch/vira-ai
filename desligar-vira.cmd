@echo off
setlocal EnableExtensions

echo Encerrando os servicos locais do VIRA.AI...

for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /R /C:":3000 .*LISTENING"') do call :stop_process %%P
for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /R /C:":8000 .*LISTENING"') do call :stop_process %%P

echo VIRA.AI desligado.
exit /b 0

:stop_process
taskkill /PID %~1 /T /F >nul 2>&1
exit /b 0
