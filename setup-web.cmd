@echo off
setlocal

set "PNPM_FALLBACK=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
set "NODE_FALLBACK=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"

if exist "%NODE_FALLBACK%\node.exe" set "PATH=%NODE_FALLBACK%;%PATH%"

where pnpm >nul 2>&1
if %errorlevel% equ 0 (
  echo Instalando dependencias do VIRA.AI...
  call pnpm install
  exit /b %errorlevel%
)

if exist "%PNPM_FALLBACK%" (
  echo Instalando dependencias do VIRA.AI...
  call "%PNPM_FALLBACK%" install
  exit /b %errorlevel%
)

where npm >nul 2>&1
if %errorlevel% equ 0 (
  echo Instalando dependencias do VIRA.AI...
  call npm install
  exit /b %errorlevel%
)

echo Nenhum gerenciador de pacotes foi encontrado.
echo Instale o Node.js LTS ou adicione pnpm ao PATH e tente novamente.
exit /b 1
