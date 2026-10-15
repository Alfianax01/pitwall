# 🏎️ PitWall — Formula 1 Live Timing, Telemetry Analysis & Season Calendar Dashboard

PitWall adalah dashboard telemetri dan live timing Formula 1 modern yang dibangun dengan arsitektur **Next.js 14 App Router, TypeScript, Tailwind CSS, TanStack Query, Recharts, dan Zod**.

Platform ini dirancang untuk menghadirkan kontrol pit wall profesional langsung ke peramban Anda, baik saat balapan sedang berlangsung secara real-time maupun untuk menganalisis sesi balapan yang telah selesai melalui scrubber lap replay interaktif.

---

## 🚀 Fitur Utama

1. **Live Timing & Lap Replay Scrubber (`/live`)**:
   - Timing tower real-time dengan update interval, gap ke leader, perolehan posisi (+/-) dengan animasi visual flash up (hijau) dan flash down (merah).
   - Pengelompokan data lap, sektor, stint ban aktif beserta umur ban (compound & age).
   - Mode LIVE otomatis (polling 4 detik ke OpenF1 feed) dan mode REPLAY dengan scrubber slider untuk memutar ulang balapan lap-demi-lap.
   - Status bendera trek (Green, Yellow, Safety Car, VSC, Red Flag) dan cuaca trek (Suhu udara, suhu aspal, kelembaban, angin, hujan).
   - Feed pesan Race Control terintegrasi.

2. **Analisis Per Lap & Strategi Ban (`/analysis`)**:
   - Grafik interaktif berbasis **Recharts**:
     - Perbandingan Lap Times over Laps dengan highlighting periode Safety Car / VSC.
     - Perubahan Gap to Leader sepanjang balapan.
     - Posisi pembalap dari lap ke lap (Progression chart).
     - Timeline / Gantt Chart visual untuk strategi stint ban setiap pembalap (Soft, Medium, Hard, Intermediate, Wet).
   - Pemilih multi-driver untuk membandingkan pembalap tertentu.

3. **Kalender Musim F1 & Sinkronisasi iCal (`/calendar` & `/calendar/[round]`)**:
   - Kalender balapan resmi musim berjalan dengan rincian ronde, nama sirkuit, dan bendera negara.
   - Tampilan Daftar (List View) & Kalender Bulanan (Month View).
   - Ekspor kalender satu musim penuh atau per-ronde ke format `.ics` (kompatibel dengan Google Calendar, Apple Calendar, dan Outlook).
   - Perincian waktu sesi (FP1, FP2, FP3, Qualifying, Sprint, Race) dengan konversi waktu Sirkuit, Waktu Lokal Pengguna, dan WIB (UTC+7).
   - Hasil podium resmi untuk balapan yang telah selesai.

4. **Desain & Pengalaman Pengguna**:
   - Dukungan tema **Dark Mode** & **Light Mode** dengan persistensi lokal.
   - Dukungan dwibahasa: **Bahasa Indonesia (ID)** & **English (EN)**.
   - Desain responsif untuk perangkat desktop, tablet, dan smartphone.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management & Caching**: [TanStack Query v5](https://tanstack.com/query)
- **Visualisasi & Charts**: [Recharts](https://recharts.org/)
- **Skema Validasi**: [Zod](https://zod.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Data Providers**: [OpenF1 API](https://openf1.org/) & [Jolpica-F1 / Ergast API](https://api.jolpi.ca/)

---

## 📦 Menjalankan Proyek

### 1. Prasyarat
- Node.js versi 18 ke atas (disarankan Node.js 20+)
- npm / pnpm / yarn

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env.local`)
Salin file `.env.example` ke `.env.local`:
```bash
cp .env.example .env.local
```
Opsional: Masukkan API key jika Anda memiliki akun OpenF1 berbayar. Tanpa API key, PitWall akan berjalan dalam mode Replay otomatis menggunakan sesi balapan terakhir.

### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka browser di [http://localhost:3000](http://localhost:3000).

### 5. Typecheck & Build Produksi
```bash
npm run typecheck
npm run build
```

---

## 📁 Struktur Direktori

```text
pitwall/
├── .env.example
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── api/
    │   │   └── f1/
    │   │       ├── calendar/
    │   │       │   └── route.ts
    │   │       ├── calendar/[round]/
    │   │       │   └── route.ts
    │   │       ├── sessions/
    │   │       │   └── route.ts
    │   │       └── timing/
    │   │           └── route.ts
    │   ├── calendar/
    │   │   ├── page.tsx
    │   │   └── [round]/
    │   │       └── page.tsx
    │   ├── live/
    │   │   └── page.tsx
    │   └── analysis/
    │       └── page.tsx
    ├── components/
    │   ├── providers.tsx
    │   ├── navbar.tsx
    │   ├── footer.tsx
    │   └── tyre-badge.tsx
    └── lib/
        └── f1/
            ├── schemas.ts
            ├── http.ts
            ├── jolpica-provider.ts
            ├── openf1-provider.ts
            ├── index.ts
            ├── ics.ts
            └── i18n.ts
```

---

## ⚖️ Penafian (Disclaimer)
PitWall adalah proyek komunitas independen nirlaba yang dibuat oleh penggemar dan **tidak berafiliasi, disponsori, atau didukung oleh Formula One Group, Formula One Management (FOM), atau Fédération Internationale de l'Automobile (FIA)**. Hak cipta Formula 1, F1, dan merek terkait dimiliki oleh pemiliknya masing-masing.
