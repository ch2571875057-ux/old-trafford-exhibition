# -*- coding: utf-8 -*-
"""
老特拉福德球场 · 交互式三维展览 —— 桌面版入口
===========================================================================
打包成 exe 后双击即可运行，不需要用户自己起服务器：

1. 在 127.0.0.1 上取一个空闲端口，用内置 HTTP 服务器把展览目录（index.html /
   js / styles.css / assets / vendor）发布出去。之所以必须走 http://，是因为
   页面用的是 ES module + fetch（file:// 协议下会被安全策略拦下），而且 29 MB
   的 GLB 需要走 HTTP 流式读取。
2. 开窗口有两种通路，按可用性自动选：
   · WebView2（pywebview）：进程内窗口，最干净。注意它依赖 CLR 从磁盘加载
     托管程序集，**安装路径含中文时会失败**（clr_loader 的路径处理问题），
     所以只在路径是纯 ASCII 时能成立；
   · Edge 应用窗口：`msedge --app=` 起一个没有地址栏的独立窗口，用专属
     user-data-dir（不污染用户浏览器）。这条路只依赖 WebView2/Edge 运行时，
     对中文路径免疫——装在这个项目目录里就是走它。
3. 窗口的存活由页面心跳决定：窗口里加载的是 desktop/host.html（一个铺满
   窗口的 iframe + 每 2 秒一次 /__ping）。心跳停了就认为用户关了窗口，
   exe 自行退出，不会留后台进程。

命令行开关（排查用）
  --selftest     只起服务器并检查关键资源，结果写进 exe 同目录的
                 selftest.log 后退出（无界面环境验证打包用）
  --port N       指定端口（默认自动挑空闲端口）
  --browser      跳过 WebView2，直接用 Edge 应用窗口
  --devtools     打开 WebView2 的开发者工具
===========================================================================
"""

from __future__ import annotations

import argparse
import functools
import http.server
import mimetypes
import os
import socket
import socketserver
import sys
import threading
import time
import urllib.request

APP_NAME = "老特拉福德球场"
WINDOW_TITLE = "老特拉福德球场 · 交互式三维展览"
WINDOW_SIZE = (1600, 980)
MIN_SIZE = (1080, 700)
BACKGROUND = "#0a0708"

# 页面心跳超过这么久没来，就认为窗口已经关掉。
# 取 90 秒：首次进入要下载并解析 29 MB 模型，主线程会被连坐十几到几十秒，
# host.html 里的 setInterval 跟着一起停；30 秒以内的超时在慢机器上会把窗口
# 活活掐掉。放宽到 90 秒，真正关窗时多等一分多钟也还能接受。
PING_TIMEOUT = 90.0
PING_INTERVAL = 2.0

# 打包时要收进来、selftest 也要检查的文件
REQUIRED_FILES = (
    "index.html",
    "styles.css",
    "js/app.js",
    "js/data.js",
    "js/stadium.js",
    "vendor/three.module.js",
    "vendor/addons/loaders/GLTFLoader.js",
    "assets/old-trafford.glb",
    "assets/manchester-united-anthem.mp3",
)

# 最近一次心跳的时间戳（0 表示还没收到过）与累计次数，用于判活与排查
LAST_PING = 0.0
PING_COUNT = 0


def exe_dir() -> str:
    """exe（或脚本）所在目录。"""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def app_root() -> str:
    """打包后是 PyInstaller 的解包目录，开发时是仓库根目录。"""
    if getattr(sys, "frozen", False):
        return getattr(sys, "_MEIPASS", exe_dir())
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def local_app_dir() -> str:
    base = os.path.join(os.path.expanduser("~"), "AppData", "Local", "OldTrafford")
    try:
        os.makedirs(base, exist_ok=True)
    except Exception:  # noqa: BLE001
        pass
    return base


def log_path() -> str:
    for folder in (exe_dir(), local_app_dir()):
        try:
            os.makedirs(folder, exist_ok=True)
            return os.path.join(folder, "old-trafford.log")
        except Exception:  # noqa: BLE001
            continue
    return os.devnull


def emit(message: str) -> None:
    """
    打包成窗口程序后 sys.stdout 是 None，直接 print 会抛 AttributeError，
    所以这里只写日志文件，有控制台时顺手打一行。
    """
    try:
        if sys.stdout is not None:
            print(message, flush=True)
    except Exception:  # noqa: BLE001
        pass
    try:
        with open(log_path(), "a", encoding="utf-8") as handle:
            handle.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}\n")
    except Exception:  # noqa: BLE001
        pass


def pick_port(preferred: int = 0) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", preferred))
        return int(sock.getsockname()[1])


def is_ascii_path(path: str) -> bool:
    try:
        path.encode("ascii")
        return True
    except UnicodeEncodeError:
        return False


class AppHandler(http.server.SimpleHTTPRequestHandler):
    """静态文件 + 两个内建路由：/__host（窗口外壳）与 /__ping（心跳）。"""

    def log_message(self, fmt, *args):  # noqa: D401 - 静默
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):  # noqa: N802 - 覆盖父类
        global LAST_PING, PING_COUNT
        route = self.path.split("?", 1)[0]
        if route == "/__ping":
            LAST_PING = time.time()
            PING_COUNT += 1
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if route in ("/__host", "/__host/"):
            self.serve_host_page()
            return
        super().do_GET()

    def serve_host_page(self):
        candidates = (
            os.path.join(app_root(), "host.html"),
            os.path.join(app_root(), "desktop", "host.html"),
        )
        payload = None
        for candidate in candidates:
            try:
                with open(candidate, "rb") as handle:
                    payload = handle.read()
                break
            except Exception:  # noqa: BLE001
                continue
        if payload is None:
            emit("host.html missing in " + repr(candidates))
            self.send_error(500, "host.html missing")
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


class ThreadedServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


def start_server(root: str, port: int) -> ThreadedServer:
    mimetypes.add_type("model/gltf-binary", ".glb")
    mimetypes.add_type("audio/mpeg", ".mp3")
    handler = functools.partial(AppHandler, directory=root)
    httpd = ThreadedServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def wait_until_ready(url: str, timeout: float = 10.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as response:
                if response.status == 200:
                    return True
        except Exception:  # noqa: BLE001
            time.sleep(0.12)
    return False


def find_edge() -> str | None:
    for candidate in (
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe"),
    ):
        if os.path.isfile(candidate):
            return candidate
    return None


def open_with_webview(url: str, devtools: bool = False) -> bool:
    """进程内 WebView2 窗口；失败返回 False（原因写进日志）。"""
    try:
        import webview  # type: ignore
    except Exception as exc:  # noqa: BLE001
        emit(f"webview import failed: {exc!r}")
        return False

    try:
        webview.create_window(
            WINDOW_TITLE,
            url,
            width=WINDOW_SIZE[0],
            height=WINDOW_SIZE[1],
            min_size=MIN_SIZE,
            background_color=BACKGROUND,
        )
        webview.start(debug=devtools)
        return True
    except Exception as exc:  # noqa: BLE001
        import traceback

        emit("webview start failed: " + repr(exc))
        emit(traceback.format_exc())
        return False


def profile_root() -> str | None:
    """
    一个**纯 ASCII 且真的能写**的目录，用来放 Edge 的临时 user-data-dir。

    两条硬约束（都实测过）：
    1. `--user-data-dir` 落在中文路径下时 Edge 会静默不弹窗（`dist\\老特拉福德球场\\...`
       踩过），所以路径必须全 ASCII；
    2. 某些机器上 %TEMP% / %LOCALAPPDATA% 会拒绝未签名 exe 建目录（PermissionError 13），
       所以候选要逐个实测写权限。

    顺序：`%PUBLIC%\\OldTrafford`（永远是 ASCII、普通用户可写）→ %LOCALAPPDATA%
    → %TEMP% → exe 目录。
    """
    candidates = [
        os.path.join(os.environ.get("PUBLIC") or "C:\\Users\\Public", "OldTrafford"),
        os.path.join(local_app_dir(), "tmp"),
        os.environ.get("TEMP"),
        os.environ.get("TMP"),
        exe_dir(),
    ]
    for candidate in candidates:
        if not candidate or not is_ascii_path(candidate):
            continue
        if probe_writable_dir(candidate):
            emit(f"profile root {candidate}")
            return candidate
    emit("no ASCII+writable profile root")
    return None


def probe_writable_dir(path: str) -> bool:
    """真的建一次目录、写一个探针文件再删掉，确认这个位置能用。"""
    probe = os.path.join(path, f".probe-{os.getpid()}")
    try:
        os.makedirs(path, exist_ok=True)
        with open(probe, "w", encoding="utf-8") as handle:
            handle.write("ok")
        os.remove(probe)
        return True
    except Exception as exc:  # noqa: BLE001
        emit(f"dir not writable {path}: {exc!r}")
        return False


def make_edge_profile(tag: str = "p") -> str | None:
    """
    给这次启动造一个**全新的** user-data-dir。

    为什么不用固定的 profile 目录：Windows 上被强杀过的 Chromium profile 会留下
    SingletonLock，甚至整个目录的 ACL 都被改写（实测遇到过 makedirs 报 WinError 5
    拒绝访问）；固定的配置目录一旦坏掉，用户双击就再也没反应。
    每次都用一个临时目录下的新 profile 最稳，代价只是丢掉缓存（本地服务器取
    29 MB 很快）。
    """
    root = profile_root()
    if root is None:
        return None
    base = os.path.join(root, f"profile-{tag}-{os.getpid()}")
    for candidate in (base, base + "-b"):
        try:
            os.makedirs(candidate, exist_ok=True)
            return candidate
        except Exception as exc:  # noqa: BLE001
            emit(f"profile dir failed {candidate}: {exc!r}")
    return None


def launch_edge(raw_args: list[str]) -> "subprocess.Popen | None":
    import subprocess

    try:
        return subprocess.Popen(raw_args, close_fds=True)
    except Exception as exc:  # noqa: BLE001
        emit(f"edge launch failed: {exc!r}")
        return None


def open_with_edge_app(url: str, tag: str = "p") -> "subprocess.Popen | None":
    """用 Edge 的应用窗口模式开一个独立、无地址栏的窗口。"""
    edge = find_edge()
    if not edge:
        emit("edge not found")
        return None

    profile = make_edge_profile(tag)
    args = [
        edge,
        f"--app={url}",
        f"--window-size={WINDOW_SIZE[0]},{WINDOW_SIZE[1]}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-features=msEdgeFirstRunExperience,Translate",
        "--disable-session-crashed-bubble",
    ]
    if profile is None:
        # 一条退路：没有临时 profile 就用 Edge 默认配置开应用窗口。
        # 会跟用户自己的浏览器共用配置，但至少窗口能出来。
        emit("no usable profile dir, using default edge profile")
    else:
        args.insert(2, f"--user-data-dir={profile}")
    process = launch_edge(args)
    if process is not None:
        emit(f"edge app launched profile={profile or '(default)'} pid={process.pid}")
    return process


def cleanup_profiles() -> None:
    """清掉自己留下的临时 profile 目录（可能被 Edge 占着，失败就忽略）。"""
    import glob
    import shutil

    root = profile_root()
    if not root:
        return
    for path in glob.glob(os.path.join(root, "profile-*")):
        try:
            shutil.rmtree(path, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass


def wait_for_client(timeout: float = 90.0) -> bool:
    """
    等窗口外壳发来第一次心跳；拿到之后按 PING_TIMEOUT 判活。
    返回 True 表示曾经连上（之后按心跳退出），False 表示一直没连上。
    """
    started = time.time()
    while time.time() - started < timeout:
        if LAST_PING > 0 and LAST_PING >= started - 1:
            return True
        time.sleep(0.2)
    return False


def wait_until_gone() -> None:
    """心跳停了就退出。"""
    while time.time() - LAST_PING < PING_TIMEOUT:
        time.sleep(0.5)
    emit(f"heartbeat stopped after {PING_COUNT} pings")


def run_selftest(base: str) -> int:
    lines = []
    ok = True
    for relative in REQUIRED_FILES:
        target = f"{base}/{relative}"
        try:
            request = urllib.request.Request(target, method="HEAD")
            with urllib.request.urlopen(request, timeout=15) as response:
                size = response.headers.get("Content-Length", "?")
                lines.append(f"OK   {relative} {response.status} {size}")
        except Exception as exc:  # noqa: BLE001
            ok = False
            lines.append(f"FAIL {relative} {exc}")

    for route in ("/index.html", "/__host"):
        try:
            with urllib.request.urlopen(base + route, timeout=15) as response:
                head = response.read(400).decode("utf-8", "replace")
            marker = "老特拉福德" in head or "<!doctype html" in head.lower()
            lines.append(f"OK   route {route} {len(head)}B marker={marker}")
        except Exception as exc:  # noqa: BLE001
            ok = False
            lines.append(f"FAIL route {route} {exc}")

    lines.append("RESULT " + ("PASS" if ok else "FAIL"))
    report = "\n".join(lines)
    emit(report)
    try:
        with open(os.path.join(exe_dir(), "selftest.log"), "w", encoding="utf-8") as handle:
            handle.write(report + "\n")
    except Exception as exc:  # noqa: BLE001
        emit(f"write selftest.log failed: {exc!r}")
    return 0 if ok else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--browser", action="store_true")
    parser.add_argument("--devtools", action="store_true")
    args = parser.parse_args(argv)

    root = app_root()
    port = pick_port(args.port)
    emit(f"start root={root} frozen={getattr(sys, 'frozen', False)} ascii={is_ascii_path(root)}")

    try:
        server = start_server(root, port)
    except Exception as exc:  # noqa: BLE001
        emit(f"start server failed: {exc!r}")
        return 2

    base = f"http://127.0.0.1:{port}"
    if not wait_until_ready(f"{base}/index.html"):
        emit("server not ready")
        return 2
    emit(f"server ready {base}")

    if args.selftest:
        code = run_selftest(base)
        server.shutdown()
        return code

    # 1) 进程内 WebView2（要求安装路径是纯 ASCII，否则 clr_loader 找不到程序集）
    if not args.browser and is_ascii_path(root):
        emit("trying webview2")
        if open_with_webview(f"{base}/index.html", args.devtools):
            emit("webview2 closed")
            server.shutdown()
            return 0

    # 2) Edge 应用窗口 + 页面心跳判活
    #    每次都用全新的 profile（见 make_edge_profile 的注释）。要是连一个可写的
    #    ASCII profile 目录都拿不到，Edge 起窗口的成功率很低，就不在这里耗时间，
    #    直接交给默认浏览器（已开着的浏览器只要新开一个标签页，不需要再写 profile）。
    if profile_root() is not None:
        emit("trying edge app window")
        process = open_with_edge_app(f"{base}/__host", tag="a")
        if process is not None and wait_for_client(timeout=60.0):
            emit("client connected")
            wait_until_gone()
            emit("client gone, shutting down")
            server.shutdown()
            cleanup_profiles()
            return 0

        emit("edge window did not answer, retrying with a fresh profile")
        try:
            if process is not None and process.poll() is None:
                process.kill()
        except Exception:  # noqa: BLE001
            pass

        process = open_with_edge_app(f"{base}/__host", tag="b")
        if process is not None and wait_for_client(timeout=60.0):
            emit("client connected (fresh profile)")
            wait_until_gone()
            emit("client gone, shutting down")
            server.shutdown()
            cleanup_profiles()
            return 0

    emit("no edge window, fallback to default browser")
    import webbrowser

    webbrowser.open(f"{base}/__host")
    # 默认浏览器不保证有窗口句柄，只能一直挂着，直到心跳停/用户关掉这个进程
    if wait_for_client(timeout=180.0):
        wait_until_gone()
    server.shutdown()
    cleanup_profiles()
    return 0


if __name__ == "__main__":
    try:
        exit_code = main()
    except SystemExit:
        raise
    except BaseException as error:  # noqa: BLE001 - 窗口版没有控制台，只能写日志
        import traceback

        emit(f"FATAL {error!r}")
        emit(traceback.format_exc())
        exit_code = 3
    sys.exit(exit_code)
