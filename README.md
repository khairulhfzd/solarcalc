# SolarCalc - SDG 7 Full-Stack & EKS HPA Lab Dashboard

Aplikasi web **SolarCalc** adalah platform interaktif bertema **SDG 7 (Energi Bersih dan Terjangkau)** yang menggabungkan kalkulator solar rooftop mandiri dengan simulasi visual **Horizontal Pod Autoscaler (HPA)** Kubernetes secara real-time.

Proyek ini telah ditingkatkan menjadi **Aplikasi Full-Stack 3-Tier** yang terintegrasi penuh dengan database **MySQL** untuk menyimpan riwayat perhitungan secara permanen.

---

## 📂 Struktur Proyek

```text
eval3/
├── frontend/
│   ├── index.html       # UI Utama (HTML, CSS murni, Vanilla JS dengan integrasi DB)
│   └── Dockerfile       # Containerization Nginx untuk melayani static files
├── backend/
│   ├── server.js        # API Server Node.js/Express (Logika HPA & Koneksi MySQL)
│   ├── package.json     # Dependensi backend (Express, CORS, & MySQL2)
│   ├── init.sql         # Script inisialisasi skema tabel database
│   └── Dockerfile       # Containerization Node.js untuk API
├── docker-compose.yml   # Orkestrasi multi-container (MySQL, BE, FE)
└── README.md            # Dokumentasi panduan setup
```

---

## ⚡ Fitur Utama & Integrasi Database

### 1. Tab 1: Halaman Utama (Kalkulator Solar, Dampak SDG 7, & Riwayat MySQL)
*   **Kalkulator Surya Pintar:** Menghitung kapasitas solar panel (kWp), proyeksi produksi bulanan (kWh), penghematan tagihan bulanan (Rp), estimasi investasi, payback period, reduksi emisi $CO_2$, hingga pohon dewasa yang setara secara instan.
*   **Simpan Hasil ke Database:** Terdapat tombol **"Simpan Hasil ke Database MySQL"** yang mengirimkan data perhitungan saat ini ke backend Express untuk dimasukkan ke database MySQL.
*   **Riwayat Perhitungan Terakhir:** Menampilkan tabel riwayat perhitungan teratas yang dibaca secara dinamis dari MySQL Database menggunakan REST API `GET /api/calculations`.
*   **Mode Fallback Cerdas:** Jika MySQL mati, sistem akan beralih ke cache RAM lokal (in-memory) secara anggun agar UI tetap berfungsi normal tanpa error crash.

### 2. Tab 2: HPA Lab (Autoscale Dashboard)
*   **UI Modern Dark Mode:** Dilengkapi aksen *glowing* neon green/blue layaknya dashboard monitoring production (seperti Grafana/Datadog).
*   **Pod Tracker & Status Indicator:** Visualisasi status pod (Running, Pending, Terminating) serta monitor penggunaan CPU masing-masing pod secara dinamis.
*   **Live Rolling Charts:** Grafik timeline yang bergerak halus menggunakan Canvas API untuk memantau Traffic (req/s) dan Latensi Waktu Respon (ms).

---

## 🚀 Cara Menjalankan Aplikasi Secara Lokal

### Metode A: Menggunakan Docker Compose (Sangat Direkomendasikan)

Pastikan Docker Desktop sudah terinstal dan berjalan di laptop Anda, lalu ketik perintah berikut pada terminal root folder proyek:

```bash
docker-compose up --build
```

Setelah build selesai dan database MySQL berhasil diinisialisasi secara otomatis:
*   **Frontend (Nginx Web Server)** dapat diakses di: `http://localhost:3000`
*   **Backend REST API** berjalan di: `http://localhost:5000`
*   **MySQL Database** terekspos di: `localhost:3306` (Username: `root`, Password: `solarpass`, Database: `solarcalc`). Anda dapat menghubungkannya via **HeidiSQL / DBeaver**!

---

### Metode B: Menjalankan Secara Manual (Tanpa Docker)

#### 1. Inisialisasi Database (HeidiSQL)
1.  Buka **HeidiSQL** Anda dan koneksikan ke local database MySQL (misalnya XAMPP / Laragon).
2.  Buat database baru bernama **`solarcalc`**.
3.  Jalankan perintah SQL berikut untuk membuat tabel `calculations`:
    ```sql
    CREATE TABLE IF NOT EXISTS calculations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        monthly_bill DECIMAL(12, 2) NOT NULL,
        house_capacity INT NOT NULL,
        sun_hours DECIMAL(4, 2) NOT NULL,
        offset_percentage INT NOT NULL,
        solar_capacity DECIMAL(6, 2) NOT NULL,
        monthly_generation INT NOT NULL,
        monthly_savings DECIMAL(12, 2) NOT NULL,
        investment_cost DECIMAL(12, 2) NOT NULL,
        payback_period DECIMAL(4, 2) NOT NULL,
        co2_offset DECIMAL(10, 2) NOT NULL,
        trees_planted INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ```

#### 2. Jalankan Backend (Node.js)
1.  Buka terminal di folder `backend/`.
2.  Install dependensi baru (`mysql2`):
    ```bash
    npm install
    ```
3.  Konfigurasikan variabel lingkungan database jika berbeda (default: `localhost:3306`, root, tanpa password).
4.  Jalankan server backend:
    ```bash
    npm start
    ```

#### 3. Jalankan Frontend (HTML Statis)
*   Buka file `frontend/index.html` langsung di browser Anda. Aplikasi akan mendeteksi status backend secara otomatis, mengaktifkan sinkronisasi database, dan menampilkan data riwayat perhitungan MySQL!
