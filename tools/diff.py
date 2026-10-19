#!/usr/bin/env python3
# ============================================================
# 截图回归比对
#
#   用法：tools/diff.py <基准目录> <对比目录> [--max-rmse 2.0] [--scale 8] [--map 目录]
#   例：  tools/diff.py tools/baseline/v0.9 tools/after/v1.0
#         tools/diff.py tools/baseline/v2.0 tools/after/v2.1 --map /tmp/diffmap
#
# 为什么要降采样：
#   场景贴图是运行时用随机数程序化生成的，同一版本连拍两次，
#   全分辨率 RMSE 也有 3%~4%。直接卡 2% 只会得到假阳性。
#   降到 1/8（200×125）后，纹理颗粒被平均掉，结构、构图、
#   明暗关系仍然保留；同一版本连拍噪声约 0.8%。
#
# 判定：结构 RMSE 超过阈值即失败；全分辨率数值仅作参考。
#   --map 会把每张的差异放大 8 倍存成图片，肉眼确认"差异只出现在
#   预期的地方"（比如只动了水面和界面）比看数字可靠。
#
# 依赖：pillow（pip install pillow）
# ============================================================
import argparse
import math
import os
import sys

from PIL import Image, ImageChops


def rmse(a, b):
    d = ImageChops.difference(a, b)
    hist = d.histogram()
    n = a.size[0] * a.size[1]
    sq = 0
    for ch in range(3):
        for value, count in enumerate(hist[ch * 256:(ch + 1) * 256]):
            sq += value * value * count
    return math.sqrt(sq / (n * 3)) / 255 * 100


def compare(path_a, path_b, scale, map_path=None):
    a = Image.open(path_a).convert("RGB")
    b = Image.open(path_b).convert("RGB")
    if a.size != b.size:
        return None, None, None

    full = rmse(a, b)

    diff = ImageChops.difference(a, b)
    if map_path:
        # 放大 8 倍，肉眼看清差异落在哪；再叠一层灰度底，方便分辨位置
        gray = a.convert("L").point(lambda v: v // 3)
        base = Image.merge("RGB", (gray, gray, gray))
        Image.blend(base, diff.point(lambda v: min(255, v * 8)), 0.85).save(map_path)

    small = (max(1, a.size[0] // scale), max(1, a.size[1] // scale))
    sa = a.resize(small, Image.BOX)
    sb = b.resize(small, Image.BOX)
    struct = rmse(sa, sb)

    bbox = diff.getbbox()
    return full, struct, bbox


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("baseline")
    ap.add_argument("candidate")
    ap.add_argument("--max-rmse", type=float, default=2.0,
                    help="结构 RMSE 上限（%%，默认 2.0）")
    ap.add_argument("--scale", type=int, default=8,
                    help="降采样倍数（默认 8）")
    ap.add_argument("--map", dest="map_dir", default=None,
                    help="把放大后的差异图写到这个目录")
    args = ap.parse_args()

    if not os.path.isdir(args.baseline) or not os.path.isdir(args.candidate):
        print("目录不存在", file=sys.stderr)
        return 2
    if args.map_dir:
        os.makedirs(args.map_dir, exist_ok=True)

    names = sorted(set(os.listdir(args.baseline)) & set(os.listdir(args.candidate)))
    names = [n for n in names if n.lower().endswith(".png")]
    if not names:
        print("没有可对比的 png", file=sys.stderr)
        return 2

    worst = 0.0
    failed = []
    print(f"{'机位':<10} {'全分辨率':>9} {'结构':>8}   变化区域")
    print("-" * 60)
    for n in names:
        map_path = os.path.join(args.map_dir, n) if args.map_dir else None
        full, struct, bbox = compare(
            os.path.join(args.baseline, n), os.path.join(args.candidate, n), args.scale, map_path
        )
        if full is None:
            print(f"{n:<10} 尺寸不一致")
            failed.append(n)
            continue
        print(f"{n:<10} {full:8.3f}% {struct:7.3f}%   {bbox}")
        worst = max(worst, struct)
        if struct > args.max_rmse:
            failed.append(n)

    print("-" * 60)
    print(f"最大结构 RMSE {worst:.3f}%（阈值 {args.max_rmse}%，降采样 1/{args.scale}）")
    if failed:
        print("未通过：" + ", ".join(failed))
        return 1
    print("通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
