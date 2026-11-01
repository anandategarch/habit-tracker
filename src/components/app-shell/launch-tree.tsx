'use client';

import { cn } from '@/lib/utils';

/**
 * Original Rutina launch tree.
 * Dibangun sebagai satu SVG berlapis: akar → batang → cabang → kanopi daun.
 * Tidak memakai artwork grow-*.svg lama, sehingga bentuk dan timing dapat
 * dikendalikan langsung oleh CSS tanpa crossfade antar gambar.
 */
export function LaunchTree({ className, size = 220 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn('launch-tree relative', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Pohon Rutina tumbuh dari akar, membentuk cabang, lalu menumbuhkan daun"
    >
      <svg viewBox="0 0 320 320" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="rutina-bark" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#76533A" />
            <stop offset="1" stopColor="#B1845D" />
          </linearGradient>
          <linearGradient id="rutina-leaf" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#238765" />
            <stop offset=".55" stopColor="#53B98B" />
            <stop offset="1" stopColor="#A3DDB2" />
          </linearGradient>
          <radialGradient id="rutina-ground-glow">
            <stop offset="0" stopColor="#70C9A0" stopOpacity=".24" />
            <stop offset="1" stopColor="#70C9A0" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse className="launch-tree-aura" cx="160" cy="166" rx="116" ry="118" fill="url(#rutina-ground-glow)" />
        <ellipse className="launch-tree-ground" cx="160" cy="278" rx="70" ry="8" />

        {/* Akar muncul lebih dulu, menyebar dari pangkal. */}
        <g className="launch-tree-roots" fill="none" stroke="#8B684B" strokeLinecap="round">
          <path d="M160 270 C145 280 129 283 111 282" />
          <path d="M160 270 C175 280 191 283 209 282" />
          <path d="M158 270 C151 282 149 289 148 294" />
          <path d="M162 270 C169 282 171 289 172 294" />
        </g>

        {/* Batang tunggal bercabang organik; semua garis digambar dari pangkal. */}
        <g className="launch-tree-wood" fill="none" stroke="url(#rutina-bark)" strokeLinecap="round" strokeLinejoin="round">
          <path className="launch-tree-trunk" d="M160 270 C157 239 163 209 160 177 C158 150 161 119 160 91" />
          <path className="launch-tree-branch launch-tree-branch-a" d="M160 211 C143 190 119 180 91 171 C77 166 67 155 60 141" />
          <path className="launch-tree-branch launch-tree-branch-b" d="M160 190 C180 172 205 160 231 151 C247 145 256 132 260 117" />
          <path className="launch-tree-branch launch-tree-branch-c" d="M160 151 C143 132 130 113 125 91 C122 78 113 68 101 61" />
          <path className="launch-tree-branch launch-tree-branch-d" d="M160 133 C178 115 191 94 195 72 C198 59 208 49 221 43" />
          <path className="launch-tree-branch launch-tree-branch-e" d="M160 110 C151 91 151 73 158 53" />
        </g>

        {/* Kanopi terdiri dari daun individual, bukan gambar pohon bertahap. */}
        <g className="launch-tree-canopy">
          <path className="launch-tree-leaf leaf-01" d="M91 171 C56 168 44 143 53 119 C79 123 99 145 91 171Z" />
          <path className="launch-tree-leaf leaf-02" d="M78 145 C48 132 43 107 57 87 C81 99 91 124 78 145Z" />
          <path className="launch-tree-leaf leaf-03" d="M125 91 C99 78 94 53 109 34 C131 49 139 72 125 91Z" />
          <path className="launch-tree-leaf leaf-04" d="M101 61 C77 47 77 25 94 10 C114 28 119 48 101 61Z" />
          <path className="launch-tree-leaf leaf-05" d="M160 91 C137 69 143 43 160 27 C179 46 182 72 160 91Z" />
          <path className="launch-tree-leaf leaf-06" d="M195 72 C178 48 188 24 211 15 C225 39 219 61 195 72Z" />
          <path className="launch-tree-leaf leaf-07" d="M221 43 C207 20 220 1 245 0 C254 25 244 42 221 43Z" />
          <path className="launch-tree-leaf leaf-08" d="M231 151 C218 122 232 101 257 96 C267 121 256 143 231 151Z" />
          <path className="launch-tree-leaf leaf-09" d="M260 117 C250 91 267 73 291 75 C295 101 281 117 260 117Z" />
          <path className="launch-tree-leaf leaf-10" d="M160 177 C137 159 139 135 160 119 C181 138 182 160 160 177Z" />
          <path className="launch-tree-leaf leaf-11" d="M117 185 C91 178 83 157 96 138 C119 151 129 169 117 185Z" />
          <path className="launch-tree-leaf leaf-12" d="M203 165 C205 139 226 126 248 137 C243 161 225 174 203 165Z" />
          <path className="launch-tree-leaf leaf-13" d="M139 119 C116 103 117 81 136 67 C154 86 155 106 139 119Z" />
          <path className="launch-tree-leaf leaf-14" d="M181 113 C177 87 194 70 218 76 C220 100 204 116 181 113Z" />
          <path className="launch-tree-leaf leaf-15" d="M160 54 C143 33 152 11 174 4 C189 26 182 47 160 54Z" />
        </g>

        {/* Tulang daun memberi detail halus saat kanopi terbuka. */}
        <g className="launch-tree-veins" fill="none" stroke="#D7F2DF" strokeWidth="1.4" strokeLinecap="round">
          <path d="M91 171 Q72 145 55 122 M125 91 Q119 63 110 36 M160 91 Q160 57 160 29 M195 72 Q207 43 211 18 M231 151 Q246 122 257 99 M160 177 L160 121" />
        </g>

        {/* Titik-titik cahaya kecil hanya muncul saat pohon selesai tumbuh. */}
        <g className="launch-tree-fireflies" fill="#E4C978">
          <circle cx="52" cy="93" r="3" />
          <circle cx="273" cy="57" r="2.5" />
          <circle cx="214" cy="205" r="2" />
          <circle cx="105" cy="213" r="2.5" />
        </g>
      </svg>
    </div>
  );
}
