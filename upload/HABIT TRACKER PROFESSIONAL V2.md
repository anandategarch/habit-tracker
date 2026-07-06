# HABIT TRACKER PROFESSIONAL V2.0 (GOOGLE APPS SCRIPT)

## ROLE

Bertindak sebagai **Principal Google Apps Script Engineer**, **Google Workspace Solution
Architect**, **Spreadsheet Performance Engineer**, **UI/UX Designer**, dan **Data Visualization
Specialist** dengan pengalaman lebih dari 20 tahun.

Anda bertugas membangun sebuah aplikasi **Habit Tracker Professional V2.0** yang seluruhnya
berjalan di Google Spreadsheet menggunakan Google Apps Script.

Aplikasi harus memiliki kualitas setara software premium dan siap digunakan sebagai produk nyata.

---

# TUJUAN

Bangun aplikasi Habit Tracker yang:

* Modern

* Sangat cepat

* Mudah digunakan

* Modular

* Mudah dikembangkan

* Bebas bug

* Responsive

* Siap dipakai bertahun-tahun

Bukan sekadar spreadsheet biasa, tetapi aplikasi lengkap.

---

# PLATFORM

Google Spreadsheet

Google Apps Script

Tanpa Add-on

Tanpa Library External

Tidak menggunakan API berbayar.

---

# ARSITEKTUR

Gunakan arsitektur modular.

Pisahkan kode menjadi beberapa section:

MAIN

CONFIG

UTILITIES

SHEET BUILDER

FORMULA ENGINE

CHART ENGINE

FORMAT ENGINE

VALIDATION ENGINE

MENU

EVENT

REPORT

AI INSIGHT

EXPORT

HELPER

Setiap fungsi diberi komentar yang jelas.

---

# STRUKTUR SHEET

## 1 Dashboard

Halaman utama.

Berisi KPI Card.

Total Habit

Completion Rate

Current Streak

Longest Streak

Success Today

Weekly Completion

Monthly Completion

Best Habit

Worst Habit

Total XP

Current Level

Total Badge

Challenge Progress

Goal Progress

Mood Average

Sleep Average

Productivity Score

Semua ditampilkan dalam bentuk card modern.

Tambahkan:

Progress Ring

Weekly Chart

Monthly Chart

Heatmap

Radar Chart

Pie Chart

Line Chart

Area Chart

Leaderboard Habit

Quick Insight

Today's Focus

Today's Reminder

---

## 2 Habit Master

Kolom

Habit

Icon

Category

Priority

Difficulty

Target

Target Type

Daily

Weekly

Monthly

Color

Reminder

Start Date

End Date

Status

Notes

---

## 3 Daily Tracker

Otomatis membuat tanggal sesuai bulan yang dipilih.

Kolom:

Tanggal

Hari

Mood

Energy

Sleep

Notes

Kemudian seluruh habit menjadi checkbox.

Di kanan:

Completion %

XP

Level

Score

---

## 4 Dashboard Analytics

Berisi

Trend

Forecast

Moving Average

Completion Trend

Weekly Trend

Monthly Trend

Quarter Trend

Category Performance

Habit Distribution

Success Distribution

Failure Distribution

Correlation

---

## 5 Calendar

Calendar bulanan.

Heatmap.

Klik tanggal menuju tracker.

---

## 6 Journal

Tanggal

Mood

Stress

Energy

Sleep

Reflection

Win Today

Lesson Learned

Tomorrow Plan

---

## 7 Goal

Goal

Deadline

Progress

Priority

Status

Milestone

Achievement

---

## 8 Challenge

7 Days

14 Days

21 Days

30 Days

60 Days

90 Days

365 Days

---

## 9 Reward

Reward Name

Unlock Condition

Status

Date

---

## 10 Badge

Badge

Requirement

Unlocked

---

## 11 Statistics

Total Completion

Miss Count

Success Rate

Average Score

Best Day

Worst Day

Best Week

Best Month

Longest Success

Longest Failure

---

## 12 AI Insight

Menganalisis pola.

Contoh:

Hari terbaik.

Hari terburuk.

Habit yang paling sering gagal.

Jam terbaik.

Mood terbaik.

Rekomendasi otomatis.

---

## 13 Settings

Nama

Bulan

Tahun

Target Completion

Tema

Warna Primer

Warna Sekunder

Awal Minggu

Bahasa

---

# UI

Gunakan desain modern.

Inspirasi:

Notion

Linear

Google Material Design 3

Minimalis.

Background putih.

Card dengan sudut membulat.

Shadow tipis.

Border tipis.

Icon.

Spacing rapi.

Warna dominan:

Hijau

Putih

Abu

Hitam

Gunakan emoji atau unicode icon.

---

# FITUR

Custom Menu

Sidebar

Dialog

Toast Notification

Generate Month

Duplicate Previous Month

Archive Month

Reset Month

Backup

Restore

Export PDF

Export Excel

Import Data

Dark Mode

Light Mode

Auto Refresh

Auto Formula

Auto Formatting

Auto Resize

Auto Freeze

Auto Filter

Auto Validation

Auto Dropdown

Auto Checkbox

Auto Conditional Formatting

Auto Chart

Auto Dashboard

Auto Insight

---

# CHART

Line Chart

Column Chart

Bar Chart

Area Chart

Pie Chart

Radar Chart

Heatmap

Sparkline

Gauge

Progress Ring

---

# GAMIFICATION

XP

Level

Achievement

Reward

Badge

Daily Mission

Weekly Mission

Monthly Mission

Season Challenge

Progress Bar

Combo

Multiplier

---

# INSIGHT

Cari otomatis:

Habit terbaik

Habit terburuk

Hari tersibuk

Hari paling produktif

Kategori terbaik

Kategori terburuk

Trend meningkat

Trend menurun

Prediksi completion akhir bulan

Prediksi streak

Rekomendasi otomatis

---

# PERFORMA

Seluruh operasi menggunakan:

getValues()

setValues()

Batch Update

RangeList

CacheService

PropertiesService

SpreadsheetApp.flush()

Tidak boleh membaca sel satu per satu.

Tidak boleh menggunakan loop yang mengakses Spreadsheet berkali-kali.

Gunakan Array semaksimal mungkin.

Target mampu menangani:

100 Habit

10 Tahun Data

Tanpa lag.

---

# VALIDASI

Script wajib memeriksa:

Sheet tersedia.

Jumlah baris cukup.

Jumlah kolom cukup.

Range valid.

Chart valid.

Formula valid.

Dropdown valid.

Checkbox valid.

Nama sheet unik.

Data kosong.

Tanggal kosong.

User input salah.

Tidak boleh muncul error:

Those rows are out of bounds

Those columns are out of bounds

Cannot delete all sheets

Cannot call method of null

Range not found

Chart Error

Formula Error

Sheet Error

---

# KUALITAS KODE

Gunakan:

const

let

Arrow Function bila sesuai

Nama fungsi jelas

Kode modular

Reusable

Mudah dipelihara

Komentar lengkap

Tidak ada kode duplikat.

---

# OUTPUT

Berikan:

1. Struktur arsitektur proyek.

2. Daftar seluruh fungsi.

3. Flow aplikasi.

4. Seluruh file Code.gs lengkap.

5. Tidak boleh ada kode yang dipotong.

6. Jika melebihi batas panjang respons, lanjutkan otomatis ke bagian berikutnya tanpa mengulang
atau menghilangkan kode.

7. Pastikan seluruh script dapat langsung di-copy ke Google Apps Script dan dijalankan tanpa error.

8. Setelah selesai, lakukan audit mandiri terhadap seluruh kode untuk memastikan tidak ada bug,
error runtime, masalah performa, atau referensi range yang dapat menyebabkan kegagalan saat
membuat sheet maupun chart.

kalau tidak memungkinkan buat dalam beberapa part

