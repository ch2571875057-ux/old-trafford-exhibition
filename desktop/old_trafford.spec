# -*- mode: python ; coding: utf-8 -*-
"""
老特拉福德球场 · 桌面版打包脚本
===========================================================================
用法（在仓库根目录）：
    python -m PyInstaller --noconfirm --clean desktop/old_trafford.spec

产物：dist/老特拉福德球场/老特拉福德球场.exe（双击即开）

为什么是 onedir 而不是 onefile：
  PyInstaller 的单文件模式启动时要把自身解包到临时目录，这一步在本项目的
  安装路径（C:\\Users\\<用户>\\Desktop\\曼联球场，含中文）下会失败
  （bootloader 报 “Could not create temporary directory!”）；onedir 直接
  从安装目录加载，对中文路径免疫。所以这里用 onedir，并把解包目录叫
  _internal，看上去仍然是一个“一个 exe + 一个 _internal”的绿色应用。

另外注意：pywebview 的 WebView2 后端依赖 clr_loader 从磁盘加载托管程序集，
在中文路径下同样会失败（日志里能看到 “Failed to resolve
Python.Runtime.Loader.Initialize”）；此时 app.py 会自动改用 Edge 的应用窗口
模式，功能与观感一致。安装到纯英文路径时则会优先用进程内 WebView2 窗口。
===========================================================================
"""

import os

from PyInstaller.utils.hooks import collect_all

ROOT = os.path.abspath(os.path.join(SPECPATH, '..'))
APP_NAME = '老特拉福德球场'

# 页面运行需要的静态资源（图纸、预览 PNG 不参与运行时，故意不打包）
datas = [
    (os.path.join(ROOT, 'index.html'), '.'),
    (os.path.join(ROOT, 'styles.css'), '.'),
    (os.path.join(ROOT, 'js'), 'js'),
    (os.path.join(ROOT, 'vendor'), 'vendor'),
    (os.path.join(ROOT, 'assets', 'favicon.png'), 'assets'),
    (os.path.join(ROOT, 'assets', 'old-trafford.glb'), 'assets'),
    (os.path.join(ROOT, 'assets', 'manchester-united-anthem.mp3'), 'assets'),
    (os.path.join(ROOT, 'desktop', 'host.html'), '.'),
]

webview_datas, webview_binaries, webview_hidden = collect_all('webview')

analysis = Analysis(
    [os.path.join(ROOT, 'desktop', 'app.py')],
    pathex=[ROOT],
    binaries=webview_binaries,
    datas=datas + webview_datas,
    hiddenimports=webview_hidden + [
        'webview.platforms.edgechromium',
        'clr_loader',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'pydoc_data', 'unittest'],
    noarchive=False,
)

pyz = PYZ(analysis.pure)

exe = EXE(
    pyz,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name=APP_NAME,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    icon=os.path.join(ROOT, 'desktop', 'icon.ico'),
)

coll = COLLECT(
    exe,
    analysis.binaries,
    analysis.datas,
    strip=False,
    upx=False,
    name=APP_NAME,
)
