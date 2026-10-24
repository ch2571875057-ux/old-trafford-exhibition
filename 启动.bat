@echo off
rem ===========================================================================
rem  老特拉福德球场 · 交互式三维展览 —— 本地静态服务启动器
rem  ES module 在 file:// 协议下无法加载，必须通过 http:// 打开。
rem  优先使用 python -m http.server 8080；没有 Python 时回退到 npx --yes serve -l 8080
rem ===========================================================================
chcp 65001 >nul
setlocal
title 老特拉福德球场 · 本地展览服务 (127.0.0.1:8080)
cd /d "%~dp0"

set "PORT=8080"
set "URL=http://127.0.0.1:8080/"
set "PYCMD="

echo.
echo   ============================================================
echo     老特拉福德球场 · 交互式三维展览
echo     Old Trafford · Interactive 3D Exhibition
echo   ============================================================
echo.

if not exist "index.html" (
  echo   [警告] 当前目录里没有找到 index.html
  echo          请把本文件放在网站根目录（与 index.html 同级）后再运行。
  echo.
)

rem ---------- 探测 Python 运行时 ----------
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

rem ---------- 没有 Python，回退到 Node.js 的 serve ----------
where npx >nul 2>nul
if errorlevel 1 goto :no_runtime

echo   [运行时] 未检测到 Python，改用 Node.js 的 npx serve
echo   [服务]   npx --yes serve -l %PORT%
echo.
echo   [提示]   首次运行需要从网络下载 serve 包，之后走本地缓存。
echo            浏览地址：%URL%
echo            按 Ctrl+C 或直接关闭本窗口即可停止服务。
echo.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start %URL%"
npx --yes serve -l %PORT%
goto :done

:serve_python
echo   [运行时] 检测到 Python：%PYCMD%
echo   [服务]   %PYCMD% -m http.server %PORT%
echo.
echo   浏览地址：%URL%
echo   按 Ctrl+C 或直接关闭本窗口即可停止服务。
echo   （三维模型通过 ES module 加载，必须走 http:// ；直接双击 index.html 无法显示球场）
echo.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start %URL%"
%PYCMD% -m http.server %PORT%
goto :done

:no_runtime
echo   [错误] 既没有找到 Python，也没有找到 Node.js（npx）。
echo.
echo   请任选一种方式安装后重新运行本文件：
echo     · Python 3 ： 到 python.org 下载安装，务必勾选 "Add python.exe to PATH"
echo     · Node.js  ： 到 nodejs.org 下载安装即可
echo.
echo   或在 PowerShell 中手动执行：
echo     python -m http.server %PORT%
echo.
pause
goto :eof

:done
echo.
echo   本地服务已停止。
pause