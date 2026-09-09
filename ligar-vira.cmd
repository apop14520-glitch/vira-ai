@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "ROOT=%~dp0"
set "PYTHON_FALLBACK=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if exist "%PYTHON_FALLBACK%" (
  set "PYTHON_EXE=%PYTHON_FALLBACK%"
) else (
  where python >nul 2>&1
  if errorlevel 1 (
    echo Python nao foi encontrado para iniciar a API.
    echo Instale o Python ou configure o runtime local do VIRA.AI.
    exit /b 1
  )
  set "PYTHON_EXE=python"
)

call :port_in_use 8000
if errorlevel 1 (
  echo Iniciando API VIRA.AI na porta 8000...
  pushd "%ROOT%apps\api"
  set "PYTHONPATH=.runtime"
  start "VIRA.AI API" /min "%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
  popd
) else (
  echo API VIRA.AI ja esta em execucao.
)

call :port_in_use 3000
if errorlevel 1 (
  echo Iniciando frontend VIRA.AI na porta 3000...
  start "VIRA.AI Web" /min "%ComSpec%" /d /c call "%ROOT%start-web.cmd"
) else (
  echo Frontend VIRA.AI ja esta em execucao.
)

echo.
echo VIRA.AI ligado.
echo Frontend: http://127.0.0.1:3000
echo API:      http://127.0.0.1:8000/health
exit /b 0

:port_in_use
netstat -ano -p tcp | findstr /R /C:":%~1 .*LISTENING" >nul
exit /b %errorlevel%
