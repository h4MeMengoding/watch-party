@echo off
setlocal EnableExtensions

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"

set "DESKTOP_DIR=%ROOT%\packages\desktop"
set "DESKTOP_ENV=%DESKTOP_DIR%\.env"
set "PACKAGE_DIR=%DESKTOP_DIR%\dist\package"

if not exist "%DESKTOP_ENV%" (
  echo [error] Desktop env file not found: %DESKTOP_ENV%
  echo Create packages\desktop\.env first, then run this script again.
  exit /b 1
)

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "BUILD_TS=%%I"
set "OUT_DIR=%ROOT%\build\desktop-%BUILD_TS%"

echo [info] Root: %ROOT%
echo [info] Using desktop env: %DESKTOP_ENV%
echo [info] Output folder: %OUT_DIR%

pushd "%ROOT%" >nul

echo [build] Building desktop renderer...
call pnpm --filter @watch-together/desktop exec vite build
if errorlevel 1 (
  popd >nul
  exit /b 1
)

echo [build] Building Windows installer exe...
call pnpm --filter @watch-together/desktop exec electron-builder --win nsis --x64
if errorlevel 1 (
  popd >nul
  exit /b 1
)

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

set "COPIED_EXE="
for %%F in ("%PACKAGE_DIR%\WatchTogether Setup *.exe") do (
  if exist "%%~fF" (
    copy /Y "%%~fF" "%OUT_DIR%\" >nul
    set "COPIED_EXE=%%~nxF"
  )
)

popd >nul

if "%COPIED_EXE%"=="" (
  echo [error] Installer exe was not found in: %PACKAGE_DIR%
  exit /b 1
)

echo [done] Copied %COPIED_EXE%
echo [done] Desktop exe output: %OUT_DIR%
exit /b 0
