# -*- coding: utf-8 -*-
"""把一张 256×256 的 PNG 包成 Windows .ico（单条目、PNG 压缩载荷）。

只用标准库：ICO 目录项 16 字节 + PNG 原始字节即可，Windows Vista 以后都认。
用法：python desktop/make_icon.py <源PNG> <输出ICO>
"""

from __future__ import annotations

import struct
import sys


def png_to_ico(png_path: str, ico_path: str, size: int = 256) -> None:
    with open(png_path, "rb") as handle:
        payload = handle.read()
    if not payload.startswith(b"\x89PNG\r\n\x1a\n"):
        raise SystemExit("不是 PNG 文件")

    header = struct.pack("<HHH", 0, 1, 1)                 # reserved, type=icon, count
    width_byte = 0 if size >= 256 else size               # 0 表示 256
    entry = struct.pack(
        "<BBBBHHII",
        width_byte, width_byte, 0, 0,
        1, 32,                                            # planes, bit count
        len(payload),
        6 + 16,                                           # 载荷偏移 = 头 6 + 目录 16
    )
    with open(ico_path, "wb") as handle:
        handle.write(header + entry + payload)


if __name__ == "__main__":
    source, target = sys.argv[1], sys.argv[2]
    png_to_ico(source, target)
    print("wrote", target)
