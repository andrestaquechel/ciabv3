#!/usr/bin/env python3
"""Render a .pptx deck to per-slide PNGs for visual verification.

Pipeline: pptx --(LibreOffice headless)--> PDF --(pdf2image/pdftoppm)--> PNGs.

Usage:
    python3 scripts/render_deck.py <deck.pptx> [out_dir] [--dpi N]

Writes slide_01.png, slide_02.png, ... into out_dir (default:
<scratch>/render/<deck-stem>/) and prints the absolute path of each PNG.

Requires: soffice (LibreOffice + libreoffice-impress), pdftoppm (poppler-utils),
pdf2image, Pillow.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from pdf2image import convert_from_path


def which_or_die(binary: str) -> str:
    path = shutil.which(binary)
    if not path:
        sys.exit(f"ERROR: required tool '{binary}' not found on PATH.")
    return path


def pptx_to_pdf(pptx: Path, workdir: Path) -> Path:
    """Convert pptx -> pdf with headless LibreOffice into workdir."""
    soffice = which_or_die("soffice")
    # A dedicated profile dir avoids clashing with any running LO instance.
    profile = workdir / "lo-profile"
    cmd = [
        soffice,
        "--headless",
        "--norestore",
        f"-env:UserInstallation=file://{profile}",
        "--convert-to",
        "pdf",
        "--outdir",
        str(workdir),
        str(pptx),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    pdf = workdir / (pptx.stem + ".pdf")
    if not pdf.exists():
        sys.exit(
            "ERROR: LibreOffice did not produce a PDF.\n"
            f"stdout: {proc.stdout}\nstderr: {proc.stderr}"
        )
    return pdf


def pdf_to_pngs(pdf: Path, out_dir: Path, dpi: int) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    pages = convert_from_path(str(pdf), dpi=dpi)
    written: list[Path] = []
    for i, page in enumerate(pages, start=1):
        dest = out_dir / f"slide_{i:02d}.png"
        page.save(dest, "PNG")
        written.append(dest)
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Render a .pptx to per-slide PNGs.")
    parser.add_argument("pptx", help="Path to the .pptx deck.")
    parser.add_argument("out_dir", nargs="?", default=None, help="Output directory for PNGs.")
    parser.add_argument("--dpi", type=int, default=150, help="Raster DPI (default 150).")
    args = parser.parse_args()

    pptx = Path(args.pptx).expanduser().resolve()
    if not pptx.exists():
        sys.exit(f"ERROR: deck not found: {pptx}")

    which_or_die("soffice")
    which_or_die("pdftoppm")

    if args.out_dir:
        out_dir = Path(args.out_dir).expanduser().resolve()
    else:
        scratch = os.environ.get("CLAUDE_SCRATCH") or tempfile.gettempdir()
        out_dir = Path(scratch) / "render" / pptx.stem

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        pdf = pptx_to_pdf(pptx, workdir)
        pngs = pdf_to_pngs(pdf, out_dir, args.dpi)

    print(f"Rendered {len(pngs)} slide(s) at {args.dpi} DPI -> {out_dir}")
    for p in pngs:
        print(p)


if __name__ == "__main__":
    main()
