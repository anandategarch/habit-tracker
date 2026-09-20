// ---------------------------------------------------------------------------
// src/lib/image-compress.ts — kompresi foto DI KLIEN (Task 76, Bonus Gym).
//
// Dipanggil hanya di komponen 'use client' (dialog Ambil Foto): File →
// <img> (browser otomatis menerapkan rotasi EXIF) → canvas → 2× JPEG data
// URL:
//   * gambar penuh : sisi maks PHOTO_FULL_MAX_DIM  (720px, kualitas 0,72)
//   * thumbnail    : sisi maks PHOTO_THUMB_MAX_DIM (144px, kualitas 0,55)
// Prefix "data:image/jpeg;base64," dibuang — server menyimpan base64 murni.
//
// Hasil dibatasi konstanta muscle-map-photos.ts; bila tetap melebihi batas
// (praktis tidak pernah untuk 720px) → lempar Error pesan Indonesia yang
// langsung bisa ditampilkan toast oleh pemanggil.
//
// Murni util browser — tidak menyentuh DB/XP apa pun.
// ---------------------------------------------------------------------------

import {
  PHOTO_FULL_MAX_DIM,
  PHOTO_IMAGE_BASE64_MAX,
  PHOTO_THUMB_BASE64_MAX,
  PHOTO_THUMB_MAX_DIM,
} from './muscle-map-photos';

export interface CompressedPhoto {
  /** JPEG base64 murni (tanpa prefix data-URL) — sisi maks 720px. */
  imageBase64: string;
  /** JPEG base64 murni kecil (144px) untuk daftar. */
  thumbBase64: string;
}

const JPEG_PREFIX = 'data:image/jpeg;base64,';
const FULL_QUALITY = 0.72;
const THUMB_QUALITY = 0.55;

/** Muat File jadi HTMLImageElement yang siap digambar (rotasi EXIF ikut). */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('File bukan gambar yang bisa dibaca'));
    };
    img.src = url;
  });
}

/** Gambar ke canvas berskala sisi maks `maxDim`, lalu JPEG data URL. */
function drawToJpeg(img: HTMLImageElement, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pengolahan gambar');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

function stripPrefix(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/**
 * Kompres satu file foto → { imageBase64, thumbBase64 }.
 * Lewati prefix data-URL supaya siap dikirim sebagai base64 murni.
 */
export async function compressPhotoFile(file: File): Promise<CompressedPhoto> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Pilih file gambar (JPG/PNG/HEIC)');
  }
  const img = await loadImage(file);

  const imageBase64 = stripPrefix(drawToJpeg(img, PHOTO_FULL_MAX_DIM, FULL_QUALITY));
  const thumbBase64 = stripPrefix(drawToJpeg(img, PHOTO_THUMB_MAX_DIM, THUMB_QUALITY));

  if (imageBase64.length > PHOTO_IMAGE_BASE64_MAX || thumbBase64.length > PHOTO_THUMB_BASE64_MAX) {
    throw new Error('Foto terlalu besar setelah dikompres — coba foto dengan resolusi lebih kecil');
  }
  return { imageBase64, thumbBase64 };
}

/** Data-URL siap <img src> dari base64 murni. */
export function photoDataUrl(base64: string): string {
  return `${JPEG_PREFIX}${base64}`;
}
