@echo off
setlocal

set "PNPM_FALLBACK=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
set "NODE_FALLBACK=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"

if exist "%NODE_FALLBACK%\node.exe" set "PATH=%NODE_FALLBACK%;%PATH%"

where pnpm >nul 2>&1
if %errorlevel% equ 0 (
  call pnpm --filter @vira-ai/web run dev
  exit /b %errorlevel%
)

if exist "%PNPM_FALLBACK%" (
  call "%PNPM_FALLBACK%" --filter @vira-ai/web run dev
  exit /b %errorlevel%
)

where npm >nul 2>&1
if %errorlevel% equ 0 (
  call npm run dev:web
  exit /b %errorlevel%
)

echo Nenhum gerenciador de pacotes foi encontrado.
echo Execute setup-web.cmd apos instalar o Node.js LTS ou configurar pnpm.
exit /b 1
