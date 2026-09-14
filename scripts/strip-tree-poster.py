#!/usr/bin/env python3
"""Strip poster chrome (text/chips/dots/panels) dari aset SVG pohon Rutina.

Output: artwork botanical murni — data level/XP/streak asli dirender UI,
bukan teks poster statis (prinsip: tree = feedback sistem, bukan dekorasi).
"""
import re, sys, pathlib

SRC = pathlib.Path('/tmp/asset-check/pohon-rutina/pohon-concepts')
DST = pathlib.Path('/home/z/my-project/public/tree')
FILES = ['benih', 'tunas', 'pohon-muda', 'pohon-dewasa', 'berbunga', 'daun-kuning', 'dorman']

def strip_text(svg: str) -> str:
    return re.sub(r'<text\b[^>]*>.*?</text>', '', svg, flags=re.S)

def strip_chip_groups(svg: str) -> str:
    """Hapus <g> top-level yang mengandung <text> (chip label poster)."""
    out = []
    i = 0
    while True:
        m = re.search(r'<g\b[^>]*>', svg[i:])
        if not m:
            out.append(svg[i:])
            break
        start = i + m.start()
        # scan nesting
        depth = 0
        j = start
        while j < len(svg):
            open_m = re.compile(r'<g\b[^>]*>').search(svg, j)
            close_m = re.compile(r'</g>').search(svg, j)
            if close_m is None:
                break
            if open_m and open_m.start() < close_m.start():
                depth += 1
                j = open_m.end()
            else:
                depth -= 1
                j = close_m.end()
                if depth == 0:
                    break
        block = svg[start:j]
        out.append(svg[i:start])
        if '<text' not in block:
            out.append(block)  # artwork — keep
        # else: chip group — drop
        i = j
    return ''.join(out)

def strip_dots(svg: str) -> str:
    return re.sub(r'<g transform="translate\(92 934\)">.*?</g>', '', svg, flags=re.S)

def strip_panels(svg: str) -> str:
    """Hapus panel kartu UI poster (rect lebar 868 + ikon lingkaran panel)."""
    svg = re.sub(r'<rect [^>]*width="868"[^>]*/>', '', svg)
    # ikon panel daun-kuning (amber, cx=880 cy=363)
    svg = re.sub(r'<circle cx="880" cy="363"[^>]*/>', '', svg)
    return svg

def strip_empty_lines(svg: str) -> str:
    svg = re.sub(r'\n\s*\n+', '\n', svg)
    return svg.strip() + '\n'

def main():
    DST.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        raw = (SRC / f'{name}.svg').read_text()
        svg = strip_chip_groups(raw)
        svg = strip_text(svg)
        svg = strip_dots(svg)
        svg = strip_panels(svg)
        svg = strip_empty_lines(svg)
        (DST / f'{name}.svg').write_text(svg)
        texts_left = re.findall(r'<text', svg)
        print(f'{name}.svg: {len(raw)} → {len(svg)} bytes; sisa <text>: {len(texts_left)}')

if __name__ == '__main__':
    main()
