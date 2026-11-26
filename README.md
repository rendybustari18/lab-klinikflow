# KlinikFlow — Sistem Administrasi Klinik, Tagihan & Klaim Asuransi

> ⚠️ **LOCAL SECURITY TRAINING LAB — DATA DUMMY**  
> Aplikasi ini dibangun khusus untuk latihan pemecahan masalah dan pengujian secure coding dalam lingkungan lokal Docker yang terisolasi. Seluruh catatan kunjungan, tarif layanan, identitas pasien, dan data klaim bersifat sintetis dan fiktif (bukan data medis riil). Dilarang keras mendeploy aplikasi ini ke internet atau lingkungan produksi.

---

## Ringkasan Aplikasi
**KlinikFlow** adalah sistem manajemen administrasi operasional poliklinik dan fasilitas kesehatan primer (contoh tenant: Klinik Mentari dan Klinik Sehat Sentosa). Sistem ini mengintegrasikan fungsi bisnis:
- Pendaftaran dan pencarian rekam medis administratif pasien.
- Penjadwalan serta pencatatan kunjungan poliklinik dan dokter pemeriksa.
- Manajemen katalog tindakan medis, tarif layanan, dan laboratorium.
- Pembuatan faktur tagihan, simulasi kasir pelunasan, dan riwayat transaksi.
- Pengajuan dan verifikasi klaim reimbursement asuransi/penjamin serta lampiran berkas.
- Rekapitulasi laporan operasional harian dan utilitas ekspor data format CLI.
- Manajemen kepegawaian internal dan aktivasi token undangan staf.

## Arsitektur Stack
Aplikasi dirancang sebagai monorepo multi-service:
- **Frontend (`web/`)**: Vue 3 + Vite, antarmuka pengguna responsif berbahasa Indonesia dengan Pico CSS.
- **BFF / API Gateway (`bun-api/`)**: Bun runtime + TypeScript, menangani sesi JWT, katalog layanan, data pasien, kunjungan, tagihan, dan kepegawaian.
- **Legacy Service (`php-api/`)**: PHP 8.3 Apache, menangani rekapitulasi laporan, metadata lampiran klaim, persetujuan asuransi, dan simulasi ekspor tanpa shell.
- **Database (`database/`)**: MySQL 8.0 dengan skema relasional terisolasi dan inisialisasi *seed dummy* otomatis.

---

## Prasyarat Menjalankan
- **Docker Engine** (versi 24.0+)
- **Docker Compose** (versi v2.20+)
- Port bebas pada mesin host: `8080` (Web UI & Reverse Proxy API) dan `3000` (Direct Bun Gateway API).

---

## Cara Menjalankan Aplikasi

1. Masuk ke direktori KlinikFlow:
   ```bash
   cd KlinikFlow
   ```

2. Salin `.env.example` menjadi `.env`, lalu isi `JWT_SECRET` dan `INTERNAL_AUTH_SECRET` dengan **dua nilai acak yang berbeda**, masing-masing minimal 32 byte. Gunakan `openssl rand -hex 32` untuk menghasilkan setiap nilai. Isi juga kredensial MySQL: `MYSQL_ROOT_PASSWORD`, `BUN_DB_USER`/`BUN_DB_PASSWORD`, dan `PHP_DB_USER`/`PHP_DB_PASSWORD` (nilai acak berbeda, mis. `openssl rand -hex 24`; password akun aplikasi hanya boleh berisi `[A-Za-z0-9_.~+/=-]`, minimal 16 karakter). Compose menolak berjalan bila salah satu variabel wajib kosong. Jangan masukkan `.env` ke repository.

   ```bash
   cp .env.example .env
   for v in JWT_SECRET INTERNAL_AUTH_SECRET; do sed -i.bak "s/^$v=.*/$v=$(openssl rand -hex 32)/" .env; done
   for v in MYSQL_ROOT_PASSWORD BUN_DB_PASSWORD PHP_DB_PASSWORD; do sed -i.bak "s/^$v=.*/$v=$(openssl rand -hex 24)/" .env; done
   rm .env.bak
   ```

3. Bangun dan jalankan seluruh container:
   ```bash
   docker compose up -d --build
   ```

4. Periksa status kesiapan seluruh layanan:
   ```bash
   docker compose ps
   ```

5. Buka aplikasi di peramban web:
   - **Aplikasi Web**: [http://localhost:8080](http://localhost:8080)
   - **API Gateway (Bun)**: [http://localhost:3000](http://localhost:3000) (juga dapat diakses via reverse proxy di `http://localhost:8080/api`)

`APP_ORIGIN` harus sama persis dengan origin web. Konfigurasi default memakai HTTP lokal sehingga `COOKIE_SECURE=false`; gunakan HTTPS dan `COOKIE_SECURE=true` bila lingkungan mendukungnya. Cookie sesi `HttpOnly` berlaku satu jam dan dicabut saat logout; request yang mengubah data harus mengirim cookie CSRF dan header `X-CSRF-Token` yang sesuai. Frontend menanganinya otomatis.

Endpoint daftar pasien, kunjungan, tagihan, klaim, dan laporan memakai paginasi `?page=` (mulai 1) dan `?limit=` (default 20, maksimum 100; nilai lebih besar dipotong ke 100, nilai non-angka ditolak `400`). Respons tetap memuat `data` (array) ditambah `pagination: { page, limit, total, total_pages }`. Body request dibatasi 1 MB, baik di Nginx (`client_max_body_size`) maupun di gateway Bun (`maxRequestBodySize`).

Tabel `audit_log` mencatat login berhasil (`auth.login.success`), login gagal atau terkunci (`auth.login.failed`, tanpa actor; email, alasan, dan IP di `details`), logout (`auth.logout`), registrasi pasien (`patient.create`), pembuatan kunjungan (`visit.create`), serta aksi tarif, pembayaran, klaim, dan undangan. `details.ip` adalah alamat peer langsung; `details.forwarded_ip` berasal dari `X-Real-IP` Nginx dan hanya dapat dipercaya untuk request lewat port 8080.

Seluruh tabel (termasuk sesi, audit, idempotensi, dan `login_attempts`) dibuat oleh `database/01_schema.sql`; gateway tidak lagi membuat tabel saat start. Akun aplikasi dibuat oleh `database/03_app_users.sh` saat volume database pertama kali diinisialisasi, sehingga perubahan kredensial atau skema memerlukan `docker compose down -v`. Volume database lama tidak dihapus atau diperbarui otomatis. Undangan lama tidak lagi berlaku. Periksa dan rekonsiliasi status tagihan, pembayaran, serta nominal klaim lama sebelum digunakan; data seed baru hanya diterapkan pada volume baru. Akun pasien belum memiliki hubungan terverifikasi dengan rekam pasien, sehingga data klinik tidak ditampilkan kepada role pasien.

---

### Akun Database

| Akun | Dipakai oleh | Hak (pada `klinikflow_db`) |
|---|---|---|
| `root` | administrasi/inisialisasi saja | penuh; password dari `MYSQL_ROOT_PASSWORD` |
| `BUN_DB_USER` | `bun-api` | `SELECT` pada clinics, invoice_items, claims; `SELECT, INSERT` pada users, patients, visits, payments, payment_requests; `SELECT, UPDATE` pada services, invoices; `SELECT, INSERT, UPDATE` pada staff_invitations; `SELECT, INSERT, DELETE` pada auth_sessions; `SELECT, INSERT, UPDATE, DELETE` pada login_attempts; `INSERT` pada audit_log |
| `PHP_DB_USER` | `php-api` | `SELECT` pada clinics, patients, visits, claim_attachments; `SELECT, UPDATE` pada invoices, claims; `SELECT, INSERT` pada payments; `INSERT` pada audit_log |

Tidak ada akun aplikasi yang memiliki `CREATE`, `ALTER`, `DROP`, atau `GRANT`. `DELETE` hanya diberikan pada `auth_sessions` (pencabutan sesi saat logout) dan `login_attempts` (reset lockout setelah login berhasil).

---

## Akun Pengguna Dummy Lab
Seluruh akun latihan menggunakan kata sandi seragam: `password123`.

| Email Akun | Peran (Role) | Unit Klinik | Keterangan |
|---|---|---|---|
| `admin@klinikflow.local` | `admin` | Klinik Mentari | Administrator Medis & IT |
| `manager@klinikflow.local` | `manager` | Klinik Mentari | Koordinator Operasional Klinik |
| `staf1@klinikflow.local` | `staff` | Klinik Mentari | Staf Pendaftaran & Administrasi 1 |
| `staf2@klinikflow.local` | `staff` | Klinik Sehat Sentosa | Staf Pendaftaran & Administrasi 2 |
| `kasir1@klinikflow.local` | `cashier` | Klinik Mentari | Kasir Pembayaran 1 |
| `kasir2@klinikflow.local` | `cashier` | Klinik Sehat Sentosa | Kasir Pembayaran 2 |
| `pasien1@pasien.local` | `patient` | Klinik Mentari | Akun Pasien Bambang Susanto |
| `pasien2@pasien.local` | `patient` | Klinik Mentari | Akun Pasien Ratna Sari |
| `pasien3@pasien.local` | `patient` | Klinik Sehat Sentosa | Akun Pasien Agus Haryanto |
| `pasien4@pasien.local` | `patient` | Klinik Sehat Sentosa | Akun Pasien Nurul Hidayah |

> *Catatan: Tombol pemilih akun instan dan petunjuk sandi bawaan hanya tampil pada build lab, yaitu bila `VITE_LAB_MODE=true` di `.env` (default `false`). Ubah nilai lalu jalankan ulang `docker compose up -d --build web`.*

**Pembatasan login:** Nginx membatasi `POST /api/auth/login` sekitar 5 request/menit per IP (burst 5) dan menjawab `429`. Gateway juga mengunci email selama 15 menit setelah 5 kegagalan dalam 15 menit (tabel `login_attempts`); login berhasil mengatur ulang hitungan. Untuk membuka kunci saat latihan, jalankan `DELETE FROM login_attempts;` sebagai root MySQL atau tunggu 15 menit.

---

## Panduan Penggunaan Fitur

1. **Pasien & Pendaftaran**:
   - Buka menu **Pasien** untuk mencari atau mendaftarkan pasien baru.
   - Masukkan informasi nama, tanggal lahir, gender, nomor telepon, dan domisili.
2. **Kunjungan & Pemeriksaan**:
   - Buka menu **Kunjungan** untuk melihat rekam nomor registrasi UUID kunjungan.
   - Daftarkan kunjungan baru dengan memilih pasien terdaftar dan dokter pemeriksa.
3. **Tarif Tindakan Medis**:
   - Buka menu **Tarif Layanan** untuk meninjau 10 jenis layanan poliklinik.
   - Admin atau manajer dapat melihat dan mengubah tarif untuk kliniknya.
4. **Tagihan & Kasir**:
   - Buka menu **Tagihan & Kasir** untuk melihat daftar faktur pasien.
   - Klik **Proses Bayar** untuk mencatat sisa tagihan menggunakan QRIS, Tunai, atau Transfer Bank. Request yang sama memakai kunci idempotensi.
5. **Klaim Asuransi**:
   - Buka menu **Klaim Asuransi** untuk meninjau berkas reimbursement.
   - Admin atau manajer dapat menyetujui klaim berstatus diajukan jika nominalnya sama dengan sisa tagihan. Lampiran yang ditampilkan berupa metadata, bukan isi berkas.
6. **Laporan & Ekspor**:
   - Buka menu **Laporan** untuk melihat rekapitulasi transaksi harian.
   - Gunakan fitur **Ekspor Dokumen** untuk simulasi ekspor tanpa menjalankan shell.
7. **Staf & Undangan**:
   - Admin atau manajer membuat undangan role staf/kasir; token ditampilkan sekali dan berlaku 24 jam. Calon staf menggunakan tautan **Aktivasi undangan staf** pada halaman login.

## Pengujian Keamanan

`tests/security.integration.mjs` mengubah data, termasuk pembayaran dan klaim. Jalankan hanya pada database uji sekali pakai yang baru dimuat dari `database/01_schema.sql` dan `database/02_seed.sql`, dengan gateway dan PHP terhubung ke database uji tersebut. Tes memerlukan Node.js 20+ dan dependensi `bun-api` terpasang.

Tes memperbarui dan menambah baris `claims` langsung di database, sehingga `KLINIKFLOW_TEST_DB_USER` harus akun uji/admin (mis. `root` pada database sekali pakai), bukan akun aplikasi berhak minimum. Port MySQL tidak dipublikasikan ke host; jalankan tes dari container di jaringan `klinikflow-internal` atau sediakan database uji terpisah. Arahkan `KLINIKFLOW_TEST_BASE` ke gateway Bun (`http://bun-api:3000` atau `http://localhost:3000`): tes melakukan enam login berturut-turut, tepat di batas burst rate limit Nginx, sehingga menjalankannya lewat port 8080 berulang kali dalam satu menit dapat menghasilkan `429`.

Atur `KLINIKFLOW_TEST_DISPOSABLE=1`, `KLINIKFLOW_TEST_BASE`, `KLINIKFLOW_TEST_PHP_BASE`, `KLINIKFLOW_TEST_DB_HOST`, `KLINIKFLOW_TEST_DB_PORT`, `KLINIKFLOW_TEST_DB_NAME`, `KLINIKFLOW_TEST_DB_USER`, dan `KLINIKFLOW_TEST_DB_PASSWORD` sesuai lingkungan uji, lalu jalankan:

```bash
node --test tests/security.integration.mjs
```

Tes mencakup sesi dan logout, CSRF, batas peran dan klinik, komunikasi PHP, pembayaran berulang, approval klaim, dan aktivasi undangan. Tes ini bukan audit keamanan menyeluruh.

---

## Pemantauan Log & Troubleshooting
```bash
# Log seluruh layanan
docker compose logs -f

# Log khusus API Gateway (Bun)
docker compose logs -f bun-api

# Log khusus Legacy Backend (PHP)
docker compose logs -f php-api
```

---

## Cara Reset Data Lab
Untuk membersihkan data transaksi dan mengembalikan seluruh database ke kondisi *seed* awal:
```bash
docker compose down -v
docker compose up -d --build
```

# lab-klinikflow
