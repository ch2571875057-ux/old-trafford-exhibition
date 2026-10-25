@echo off
rem ===========================================================================
rem  Old Trafford Interactive 3D Exhibition - local static server launcher
rem  ES modules cannot load under file:// - the page must be served via http://
rem  Fallback order: python -m http.server -> node tools/serve.mjs (offline,
rem  zero deps) -> npx serve (last resort, downloads a package on first run)
rem ===========================================================================
setlocal
title Old Trafford Exhibition - local server (127.0.0.1:8080)
cd /d "%~dp0"

set "PORT=8080"
set "URL=http://127.0.0.1:8080/"
set "PYCMD="

echo.
echo   ============================================================
echo     Old Trafford - Interactive 3D Exhibition
echo   ============================================================
echo.

if not exist "index.html" (
  echo   [WARN] index.html not found next to this .bat file.
  echo          Keep this launcher in the repository root and retry.
  echo.
)

rem ---------- probe Python ----------
where python >nul 2>nul
if not errorlevel 1 set "PYCMD=python"
if not defined PYCMD (
  where py >nul 2>nul
  if not errorlevel 1 set "PYCMD=py -3"
)
if not defined PYCMD (
  where python3 >nul 2>nul
  if not errorlevel 1 set "PYCMD=python3"
)
if defined PYCMD goto :serve_python

rem ---------- no Python: zero-dependency Node server (offline) ----------
where node >nul 2>nul
if not errorlevel 1 goto :serve_node

rem ---------- no Node either: npx serve (needs network on first run) ----------
where npx >nul 2>nul
if errorlevel 1 goto :no_runtime

echo   [runtime] Python not found, using npx serve
echo   [server]  npx --yes serve -l %PORT%
echo.
echo   [note]    First run downloads the serve package from the network.
echo             Open: %URL%
echo             Press Ctrl+C or close this window to stop the server.
echo.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start %URL%"
npx --yes serve -l %PORT%
goto :done

:serve_node
echo   [runtime] Python not found, using the zero-dependency Node server
echo   [server]  node tools/serve.mjs %PORT%
echo.
echo   [note]    Fully offline - no packages needed.
echo             Open: %URL%
echo             Press Ctrl+C or close this window to stop the server.
echo.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start %URL%"
node tools/serve.mjs %PORT%
goto :done

:serve_python
echo   [runtime] Python found: %PYCMD%
echo   [server]  %PYCMD% -m http.server %PORT%
echo.
echo   Open: %URL%
echo   Press Ctrl+C or close this window to stop the server.
echo   (The 3D model loads via ES modules - opening index.html directly
echo    with a double click will NOT show the stadium.)
echo.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start %URL%"
%PYCMD% -m http.server %PORT%
goto :done

:no_runtime
echo   [ERROR] Neither Python nor Node.js was found.
echo.
echo   Install either one and run this file again:
echo     - Python 3 : python.org  (check "Add python.exe to PATH")
echo     - Node.js  : nodejs.org
echo.
echo   Or start a server manually in a terminal:
echo     python -m http.server %PORT%
echo     node tools/serve.mjs %PORT%
echo.
pause
goto :eof

:done
echo.
echo   Local server stopped.
pause
