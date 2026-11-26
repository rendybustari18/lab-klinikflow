# Patch Notes T02–T23 — KlinikFlow

Branch `fix`, basis `e5534a5`. Delapan commit perbaikan, **belum di-push** (menunggu review).

| Commit | Ancaman | Ringkasan |
|---|---|---|
| `521626d` | T02 | Rate limit login di nginx, lockout per email, akun demo hanya di mode lab |
| `f8bc5ee` | T23 | Secret DB ke `.env`, akun DB bun/php terpisah berhak minimum, hapus `CREATE TABLE` di gateway |
| `d1622d3` | T19 | `SELECT *` / `alias.*` diganti kolom eksplisit |
| `4525a27` | T20 | Audit login berhasil/gagal, logout, registrasi pasien, kunjungan |
| `aed6204` | T22 | Paginasi endpoint daftar + batas body 1 MB |
| `c839394` | misc | Tolak tarif <= 0 |
| `49ccf71` | misc | Validasi `full_name` pasien di server |
| `dddd8fb` | misc | `summary_html` → `summary` (teks biasa) |

---

## Ringkasan perubahan

### T02 – Login tanpa pembatasan
- **nginx** (`web/nginx.conf`): `limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m` di luar blok `server`; `location = /api/auth/login` memakai `limit_req ... burst=5 nodelay`, `limit_req_status 429`, dan `error_page` ke respons JSON 429 (`Retry-After: 60`). Lokasi tetap mem-proxy ke `bun-api`.
- **Lockout per email** (`bun-api/src/auth.ts`, tabel baru `login_attempts` di `01_schema.sql`): 5 kegagalan dalam 15 menit → login ditolak **429** selama 15 menit (dengan `Retry-After`), termasuk bila password benar. Login berhasil menghapus hitungan.
  - Percobaan **dicatat secara atomik sebelum** verifikasi password (`SELECT … FOR UPDATE` dalam transaksi singkat), sehingga request paralel tidak bisa melampaui 5 tebakan (bukti T02c: 20 request paralel → tepat 5×401, 15×429).
  - Kunci dinormalisasi `trim()+lowercase` karena kolasi MySQL tidak membedakan huruf besar/kecil dan mengabaikan spasi di akhir: `ADMIN@klinikflow.local ` tidak mendapat kuota baru.
  - Email > 254 karakter ditolak 400.
- **Login.vue**: pemilih akun, petunjuk `password123`, dan prefill email/sandi hanya ada bila `import.meta.env.VITE_LAB_MODE === 'true'`. Data demo ditulis di ekspresi yang dilipat konstan oleh Vite, jadi **tidak ikut dibundel** saat mode lab mati (terbukti: 0 kemunculan di bundle). `VITE_LAB_MODE` diteruskan sebagai build arg (`web/Dockerfile`, `docker-compose.yml`, default `false`).

### T23 – Secret & akun database
- `docker-compose.yml`: `MYSQL_ROOT_PASSWORD`, `BUN_DB_USER/PASSWORD`, `PHP_DB_USER/PASSWORD` memakai `${VAR:?pesan}`; `MYSQL_USER/MYSQL_PASSWORD` (akun `ALL PRIVILEGES`) dihapus; healthcheck tidak lagi memuat password literal (`$$MYSQL_ROOT_PASSWORD`, via TCP `127.0.0.1`). Port tidak diubah.
- `database/03_app_users.sh` (baru, di-*source* entrypoint MySQL setelah schema & seed): membuat `klinikflow_bun` dan `klinikflow_php` dengan hak **per tabel** sesuai query masing-masing; tanpa `CREATE/ALTER/DROP/GRANT`. Nama/password divalidasi charset-nya sebelum disisipkan ke SQL.
- Fallback kredensial hardcoded di `bun-api/src/db.ts` dan `php-api/src/config/db.php` dihapus (wajib dari env).
- `CREATE TABLE IF NOT EXISTS` di `bun-api/src/index.ts` dihapus.
- `.env.example` dan README diperbarui (tabel hak akun, cara membuat secret).

### T19 – Paparan data berlebih
Seluruh `SELECT *` / `alias.*` di `bun-api/src` dan `php-api/src` diganti kolom eksplisit. Daftar memuat kolom yang dirender `web/src/views`; endpoint detail tanpa konsumen frontend (invoice, visit, claim detail) tidak lagi mengirim telepon/alamat pasien, id internal (`patient_id`, `visit_id`, `invoice_id`, `clinic_id`), `notes` klaim, `created_at`, `is_active`. Query `FOR UPDATE` dipertahankan, hanya kolomnya yang dipersempit. Login tidak lagi memuat seluruh baris `users`.

### T20 – Audit log
- Skema: `audit_log.actor_id`, `clinic_id`, `entity_id` → nullable; indeks `(action, created_at)`.
- `bun-api/src/audit.ts`: helper `writeAudit` + info klien (`ip` = peer TCP, `forwarded_ip` = `X-Real-IP` dari nginx).
- Dicatat: `auth.login.success`, `auth.login.failed` (tanpa actor; `email`, `reason` = `invalid_credentials`/`locked`, `attempt`, `ip` di `details`), `auth.logout`, `patient.create`, `visit.create`. Login sukses, logout, pasien, dan kunjungan ditulis dalam **transaksi yang sama** dengan operasinya. PII dan catatan klinis tidak disalin ke audit.

### T22 – Ketersediaan
- `?page` (mulai 1) & `?limit` (default 20, maks 100; lebih besar dipotong ke 100; non-angka/≤0 → 400) di daftar pasien, kunjungan, tagihan (Bun) serta klaim & laporan (PHP, `LIMIT/OFFSET` ber-bind `PDO::PARAM_INT`). Respons tetap `data: [...]` + `pagination: {page, limit, total, total_pages}` sehingga kontrak lama dan tes tetap kompatibel.
- Frontend: komponen `Pager.vue` di halaman Pasien, Kunjungan, Tagihan, Klaim, Laporan; pemilih pasien di Kunjungan memakai `limit=100`.
- `client_max_body_size 1m` di nginx, plus `maxRequestBodySize: 1 MB` di `Bun.serve` karena gateway juga terbuka langsung di `:3000` (sebelumnya body 2 MB diterima di `:3000`).

### Perbaikan kecil
- `services.ts`: fee `0` / `0.00` ditolak 400 (sebelumnya tersimpan Rp 0). Input frontend `min="1000"` (sejalan dengan `step="1000"`).
- `patients.ts`: `full_name` di-trim, wajib 1–150 karakter, tanpa `<` atau `>` → 400.
- `reports.php`: `summary_html` → `summary`; `Reports.vue` merender `summary` sebagai teks.

---

## Catatan untuk reviewer

1. **Burst nginx = 5** (bukan lebih kecil) karena `tests/security.integration.mjs` melakukan 6 request login berturut-turut; burst 5 + 1 = 6 request sekaligus. Bila tes diarahkan ke `:8080` dua kali dalam satu menit, tes bisa kena 429. README menyarankan `KLINIKFLOW_TEST_BASE` ke gateway Bun.
2. **Deviasi dari "SELECT/INSERT/UPDATE"**: `DELETE` diberikan hanya pada `auth_sessions` (logout mencabut sesi dengan `DELETE`, perilaku lama dipertahankan) dan `login_attempts` (reset setelah login berhasil). Hak lain lebih sempit dari S/I/U penuh (per tabel sesuai kebutuhan).
3. **Lockout per email bisa disalahgunakan** untuk mengunci akun korban (5 tebakan salah). Ini trade-off bawaan lockout; rate limit per IP di nginx membatasi skalanya.
4. **`forwarded_ip`** hanya tepercaya untuk request lewat nginx; akses langsung ke `:3000` dapat memalsukan `X-Real-IP`. `ip` (peer) selalu tepercaya.
5. **`web/dist/`** yang ter-commit di repo masih berisi bundle lama dengan `password123`. Tidak dipakai Docker (image membangun ulang dari sumber), tetapi sebaiknya dihapus dari repo/ditambahkan ke `.gitignore`. Tidak saya ubah karena di luar lingkup.
6. Perbedaan waktu respons login untuk email tak terdaftar (tanpa bcrypt) masih ada (sudah ada sebelumnya, di luar lingkup).
7. Init script hanya berjalan pada volume baru, jadi perubahan ini **memerlukan `docker compose down -v`**.
8. `.env` lokal (tidak di-commit) ditambah `VITE_LAB_MODE`, `MYSQL_ROOT_PASSWORD`, `BUN_DB_*`, `PHP_DB_*` dengan nilai acak. Rekan lain perlu memperbarui `.env` mereka dari `.env.example`.

---

## Bukti

Lingkungan: `docker compose down -v && docker compose up -d --build` pada HEAD `dddd8fb`, lalu curl ke `http://localhost:8080` (kecuali yang disebut `:3000`).

### Tes regresi `tests/security.integration.mjs`
Dijalankan dari container `node:20-alpine` di jaringan `klinikflow-internal` (port MySQL tidak dipublikasikan), `KLINIKFLOW_TEST_BASE=http://bun-api:3000`, DB user `root` pada database baru:

```
TAP version 13
# Subtest: security regression against an isolated seeded lab database
ok 1 - security regression against an isolated seeded lab database
  ---
  duration_ms: 1086.004022
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1145.67015
```

### SEBELUM (stack lama, commit `e5534a5`)

```
## 6x login salah (admin@klinikflow.local)
attempt 1 -> 401
attempt 2 -> 401
attempt 3 -> 401
attempt 4 -> 401
attempt 5 -> 401
attempt 6 -> 401
attempt 7 -> 401
## login benar setelahnya
200
## GET /api/invoices (keys baris pertama)
rows= 4 keys= ['amount', 'clinic_id', 'clinic_name', 'doctor_name', 'id', 'invoice_number', 'issued_at', 'mrn', 'outstanding_amount', 'paid_at', 'patient_id', 'patient_name', 'status', 'visit_date', 'visit_id'] pagination= None 
## GET /api/visits (keys baris pertama)
rows= 4 keys= ['clinic_id', 'clinic_name', 'created_at', 'doctor_name', 'id', 'mrn', 'notes', 'patient_id', 'patient_name', 'status', 'visit_date', 'visit_uuid'] pagination= None 
## GET /api/claims (keys baris pertama)
rows= 2 keys= ['amount', 'approved_at', 'claim_number', 'claim_uuid', 'clinic_id', 'clinic_name', 'id', 'insurance_name', 'invoice_id', 'invoice_number', 'notes', 'patient_name', 'status', 'submitted_at'] pagination= None 
## GET /api/reports (keys baris pertama)
rows= 4 keys= ['amount', 'clinic_id', 'clinic_name', 'doctor_name', 'id', 'invoice_number', 'issued_at', 'mrn', 'paid_at', 'patient_id', 'patient_name', 'status', 'visit_date', 'visit_id'] pagination= None summary_html present
## GET /api/services (keys baris pertama)
rows= 5 keys= ['category', 'clinic_id', 'clinic_name', 'code', 'created_at', 'fee', 'id', 'is_active', 'name'] pagination= None 
## GET /api/patients (keys baris pertama)
rows= 2 keys= ['address', 'birth_date', 'clinic_id', 'clinic_name', 'created_at', 'full_name', 'gender', 'id', 'mrn', 'phone'] pagination= None 
## GET /api/invoices/3 keys
['address', 'amount', 'clinic_code', 'clinic_id', 'clinic_name', 'doctor_name', 'id', 'invoice_number', 'issued_at', 'items', 'mrn', 'paid_at', 'patient_id', 'patient_name', 'payments', 'phone', 'status', 'visit_date', 'visit_id']
payment keys []
phone/address: 0812111102 | Jl. Radio Dalam Raya No. 8B, Kebayoran Baru, Jakarta Selatan
## GET /api/visits/vis-9a1b-c1d2e3f4-0001 keys
['clinic_id', 'clinic_name', 'created_at', 'doctor_name', 'id', 'mrn', 'notes', 'patient_address', 'patient_id', 'patient_name', 'patient_phone', 'status', 'visit_date', 'visit_uuid']
## POST fee 0
{"success":true,"message":"Tarif layanan Rawat Luka & Ganti Verban berhasil diperbarui menjadi Rp 0","data":{"id":5,"clinic_id":1,"code":"SVC-005","name":"Rawat Luka & Ganti Verban","category":"Tindakan","fee":"0.00","is_active":1,"created_at":"2026-11-26T02:42:59.000Z"},"previous_fee":50000,"updated_fee":0}
HTTP 200
## POST patient nama <script>
{"success":true,"message":"Registrasi pasien baru berhasil","patient_id":5,"mrn":"MRN-E71D081A84148FF58F33F1D1"}
HTTP 200
## POST body 2MB
HTTP 413
## audit_log
action	COUNT(*)
service.fee.update	1
## db grants klinikflow_user
Grants for klinikflow_user@%
GRANT USAGE ON *.* TO `klinikflow_user`@`%`
GRANT ALL PRIVILEGES ON `klinikflow\\_db`.* TO `klinikflow_user`@`%`
## POST body 2MB langsung ke bun :3000
{"success":false,"error":"Data identitas pasien wajib diisi lengkap"}
HTTP 400
## GET /api/patients?limit=100000
{"success":true,"data":[{"id":1,"clinic_id":1,"mrn":"MRN-2026-001","full_name":"Bambang Susanto","birth_date":"1985-04-1
## reports summary_html
{'success': True, 'filter': '<b>x</b>', 'summary_html': 'Menampilkan arsip laporan transaksi untuk kata kunci: <b>x</b>', 'total_records': 0}
```

### SESUDAH — T02 (rate limit & lockout)

Percobaan 1–5 → 401, ke-6 → 429 dari lockout Bun (`Retry-After: 900`), ke-7 → 429 dari nginx (`Retry-After: 60`). Password benar + variasi huruf besar/spasi tetap 429.

```
### T02a: 6x login salah admin@klinikflow.local lalu request ke-7 (via :8080)
attempt 1 -> HTTP 401  {"success":false,"error":"Kredensial login klinik tidak valid"}
attempt 2 -> HTTP 401  {"success":false,"error":"Kredensial login klinik tidak valid"}
attempt 3 -> HTTP 401  {"success":false,"error":"Kredensial login klinik tidak valid"}
attempt 4 -> HTTP 401  {"success":false,"error":"Kredensial login klinik tidak valid"}
attempt 5 -> HTTP 401  {"success":false,"error":"Kredensial login klinik tidak valid"}
attempt 6 -> HTTP 429 Retry-After: 900 {"success":false,"error":"Terlalu banyak percobaan login gagal. Akun dikunci sementara, coba lagi nanti."}
attempt 7 -> HTTP 429 Retry-After: 60 {"success":false,"error":"Terlalu banyak percobaan login. Coba lagi dalam satu menit."}

### T02b: tunggu 13 dtk (1 slot nginx terisi), login dengan password BENAR untuk akun yang terkunci
HTTP 429 Retry-After: 887 {"success":false,"error":"Terlalu banyak percobaan login gagal. Akun dikunci sementara, coba lagi nanti."}
### T02c: 20 login salah PARALEL untuk staf1 langsung ke bun :3000 (tanpa nginx)
   5 401
  15 429

### login_attempts
email	failed_count	window_start	locked_until
admin@klinikflow.local	5	2026-11-26 03:16:20	2026-11-26 03:31:21
staf1@klinikflow.local	20	2026-11-26 03:16:43	2026-11-26 03:31:43
```

### SESUDAH — T19, T22, perbaikan kecil, logout

```
### login manager (via :8080)
HTTP 200

### T19: kunci respons (baris pertama) + paginasi default
/api/patients   keys= ['address', 'birth_date', 'clinic_name', 'full_name', 'gender', 'id', 'mrn', 'phone'] | pagination= {'page': 1, 'limit': 20, 'total': 2, 'total_pages': 1}
/api/visits     keys= ['clinic_name', 'doctor_name', 'id', 'mrn', 'notes', 'patient_name', 'status', 'visit_date', 'visit_uuid'] | pagination= {'page': 1, 'limit': 20, 'total': 4, 'total_pages': 1}
/api/invoices   keys= ['amount', 'clinic_name', 'doctor_name', 'id', 'invoice_number', 'issued_at', 'outstanding_amount', 'patient_name', 'status'] | pagination= {'page': 1, 'limit': 20, 'total': 4, 'total_pages': 1}
/api/claims     keys= ['amount', 'claim_number', 'claim_uuid', 'clinic_name', 'id', 'insurance_name', 'patient_name', 'status'] | pagination= {'page': 1, 'limit': 20, 'total': 3, 'total_pages': 1}
/api/reports    keys= ['amount', 'clinic_name', 'doctor_name', 'id', 'invoice_number', 'mrn', 'patient_name', 'status', 'visit_date'] | pagination= {'page': 1, 'limit': 20, 'total': 4, 'total_pages': 1}
/api/services   keys= ['category', 'clinic_name', 'code', 'fee', 'id', 'name'] | pagination= None

### T19: detail tanpa telepon/alamat pasien
/api/invoices/3 keys= ['amount', 'clinic_name', 'doctor_name', 'id', 'invoice_number', 'issued_at', 'items', 'mrn', 'paid_at', 'patient_name', 'payments', 'status', 'visit_date'] | payments keys= [['amount', 'id', 'method', 'paid_at', 'payment_ref', 'settlement_status']] False
/api/invoices/4 payments [['amount', 'id', 'method', 'paid_at', 'payment_ref', 'settlement_status']]
/api/visits/vis-9a1b-c1d2e3f4-0001 keys= ['clinic_name', 'doctor_name', 'id', 'mrn', 'notes', 'patient_name', 'status', 'visit_date', 'visit_uuid']
/api/claims/1 keys= ['amount', 'approved_at', 'attachments', 'claim_number', 'claim_uuid', 'clinic_name', 'id', 'insurance_name', 'invoice_number', 'patient_name', 'status', 'submitted_at']
grep field sensitif di seluruh respons: (kosong = tidak ada)

### T22: paginasi
patients?limit=1&page=2      HTTP 200 | rows= 1 | pagination= {'page': 2, 'limit': 1, 'total': 2, 'total_pages': 2} | error= None
visits?limit=2&page=1        HTTP 200 | rows= 2 | pagination= {'page': 1, 'limit': 2, 'total': 4, 'total_pages': 2} | error= None
invoices?limit=100000        HTTP 200 | rows= 4 | pagination= {'page': 1, 'limit': 100, 'total': 4, 'total_pages': 1} | error= None
claims?limit=1               HTTP 200 | rows= 1 | pagination= {'page': 1, 'limit': 1, 'total': 3, 'total_pages': 3} | error= None
reports?limit=3&page=2       HTTP 200 | rows= 1 | pagination= {'page': 2, 'limit': 3, 'total': 4, 'total_pages': 2} | error= None
patients?page=abc            HTTP 400 | rows= - | pagination= None | error= Parameter page dan limit harus bilangan bulat positif
claims?limit=-5              HTTP 400 | rows= - | pagination= None | error= Parameter page dan limit harus bilangan bulat positif
reports?page=0               HTTP 400 | rows= - | pagination= None | error= Parameter page dan limit harus bilangan bulat positif

### T22: body 2 MB
via nginx :8080 -> HTTP 413
langsung bun :3000 -> HTTP 413

### Tarif <= 0
fee=0      -> {"success":false,"error":"Tarif layanan harus lebih besar dari 0"} HTTP 400
fee=-5     -> {"success":false,"error":"ID layanan dan tarif biaya baru tidak valid"} HTTP 400
fee=0.00   -> {"success":false,"error":"Tarif layanan harus lebih besar dari 0"} HTTP 400
fee=88000  -> {"success":true,"message":"Tarif layanan Rawat Luka & Ganti Verban berhasil diperbarui menjadi Rp 88.000","data":{"id":5,"code":"SVC-005","name":"Rawat Luka & Ganti Verban","category":"Tindakan","fee":"88000.00"},"previous_fee":50000,"updated_fee":88000} HTTP 200

### Validasi full_name
<img src=x onerror=alert(1)>        -> {"success":false,"error":"Nama pasien wajib 1-150 karakter dan tidak boleh mengandung < atau >"} HTTP 400
Budi > Andi                         -> {"success":false,"error":"Nama pasien wajib 1-150 karakter dan tidak boleh mengandung < atau >"} HTTP 400
                                    -> {"success":false,"error":"Nama pasien wajib 1-150 karakter dan tidak boleh mengandung < atau >"} HTTP 400
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA -> {"success":false,"error":"Nama pasien wajib 1-150 karakter dan tidak boleh mengandung < atau >"} HTTP 400
  Siti Aminah                       -> {"success":true,"message":"Registrasi pasien baru berhasil","patient_id":5,"mrn":"MRN-6723DD15D95F80E180137AAC"} HTTP 200

### T20: buat kunjungan
{"success":true,"message":"Jadwal kunjungan baru berhasil dicatat","visit_id":9,"visit_uuid":"5a5079b7-d381-44e5-8e4a-62368935b85d"} HTTP 200

### reports: summary (teks biasa)
{'success': True, 'filter': '<b>x</b>', 'summary': 'Menampilkan arsip laporan transaksi untuk kata kunci: <b>x</b>', 'total_records': 0, 'pagination': {'page': 1, 'limit': 20, 'total': 0, 'total_pages': 1}}

### logout
{"success":true,"message":"Logout berhasil"} HTTP 200
me setelah logout -> HTTP 401
```

### SESUDAH — T20 (audit_log), T23 (akun DB & secret), T02 (bundle), nginx

```
### T20: audit_log (ringkasan per action)
action	n
auth.login.failed	27
auth.login.success	6
auth.logout	2
claim.approve	1
invitation.accept	1
invitation.create	1
patient.create	1
payment.process	1
service.fee.update	2
visit.create	1

### T20: contoh baris (login gagal tanpa actor, login sukses, logout, patient.create, visit.create)
id	actor_id	clinic_id	action	entity_type	entity_id	details
33	NULL	NULL	auth.login.failed	user	NULL	{"ip": "::ffff:192.168.97.1", "email": "staf1@klinikflow.local", "reason": "locked"}
38	NULL	1	auth.login.failed	user	3	{"ip": "::ffff:192.168.97.1", "email": "staf1@klinikflow.local", "locked": true, "reason": "invalid_credentials", "attempt": 5}
39	2	1	auth.login.success	user	2	{"ip": "::ffff:192.168.97.5", "forwarded_ip": "192.168.97.1"}
41	2	1	patient.create	patient	5	{"mrn": "MRN-6723DD15D95F80E180137AAC"}
42	2	1	visit.create	visit	9	{"patient_id": 1, "visit_uuid": "5a5079b7-d381-44e5-8e4a-62368935b85d"}
43	2	1	auth.logout	user	2	{"ip": "::ffff:192.168.97.5", "forwarded_ip": "192.168.97.1"}

### T23: akun MySQL
user	host
klinikflow_bun	%
klinikflow_php	%
root	%
root	localhost

### T23: hak klinikflow_bun
Grants for klinikflow_bun@%
GRANT USAGE ON *.* TO `klinikflow_bun`@`%`
GRANT INSERT ON `klinikflow_db`.`audit_log` TO `klinikflow_bun`@`%`
GRANT SELECT, INSERT, DELETE ON `klinikflow_db`.`auth_sessions` TO `klinikflow_bun`@`%`
GRANT SELECT ON `klinikflow_db`.`claims` TO `klinikflow_bun`@`%`
GRANT SELECT ON `klinikflow_db`.`clinics` TO `klinikflow_bun`@`%`
GRANT SELECT ON `klinikflow_db`.`invoice_items` TO `klinikflow_bun`@`%`
GRANT SELECT, UPDATE ON `klinikflow_db`.`invoices` TO `klinikflow_bun`@`%`
GRANT SELECT, INSERT, UPDATE, DELETE ON `klinikflow_db`.`login_attempts` TO `klinikflow_bun`@`%`
GRANT SELECT, INSERT ON `klinikflow_db`.`patients` TO `klinikflow_bun`@`%`
GRANT SELECT, INSERT ON `klinikflow_db`.`payment_requests` TO `klinikflow_bun`@`%`
GRANT SELECT, INSERT ON `klinikflow_db`.`payments` TO `klinikflow_bun`@`%`
GRANT SELECT, UPDATE ON `klinikflow_db`.`services` TO `klinikflow_bun`@`%`
GRANT SELECT, INSERT, UPDATE ON `klinikflow_db`.`staff_invitations` TO `klinikflow_bun`@`%`
GRANT SELECT, INSERT ON `klinikflow_db`.`users` TO `klinikflow_bun`@`%`
GRANT SELECT, INSERT ON `klinikflow_db`.`visits` TO `klinikflow_bun`@`%`

### T23: hak klinikflow_php
Grants for klinikflow_php@%
GRANT USAGE ON *.* TO `klinikflow_php`@`%`
GRANT INSERT ON `klinikflow_db`.`audit_log` TO `klinikflow_php`@`%`
GRANT SELECT ON `klinikflow_db`.`claim_attachments` TO `klinikflow_php`@`%`
GRANT SELECT, UPDATE ON `klinikflow_db`.`claims` TO `klinikflow_php`@`%`
GRANT SELECT ON `klinikflow_db`.`clinics` TO `klinikflow_php`@`%`
GRANT SELECT, UPDATE ON `klinikflow_db`.`invoices` TO `klinikflow_php`@`%`
GRANT SELECT ON `klinikflow_db`.`patients` TO `klinikflow_php`@`%`
GRANT SELECT, INSERT ON `klinikflow_db`.`payments` TO `klinikflow_php`@`%`
GRANT SELECT ON `klinikflow_db`.`visits` TO `klinikflow_php`@`%`

### T23: uji CREATE / DROP dengan akun aplikasi
ERROR 1142 (42000) at line 1: CREATE command denied to user 'klinikflow_bun'@'localhost' for table 'pwn'
ERROR 1142 (42000) at line 1: DROP command denied to user 'klinikflow_php'@'localhost' for table 'audit_log'
ERROR 1142 (42000) at line 1: SELECT command denied to user 'klinikflow_php'@'localhost' for table 'users'

### T23: akun lama klinikflow_user
ERROR 1045 (28000): Access denied for user 'klinikflow_user'@'localhost' (using password: YES)

### T23: literal secret di repo
tidak ada

### T23: CREATE TABLE di bun-api/src
tidak ada

### T23: compose tanpa .env
error while interpolating services.bun-api.environment.DB_PASS: required variable BUN_DB_PASSWORD is missing a value: Set BUN_DB_PASSWORD in .env
error while interpolating services.bun-api.environment.DB_USER: required variable BUN_DB_USER is missing a value: Set BUN_DB_USER in .env

### T02: bundle frontend (VITE_LAB_MODE=false)
asset: /assets/index-C6LTkpAE.js
password123              : 0 kemunculan
Pilih Akun Demo          : 0 kemunculan
admin@klinikflow.local   : 0 kemunculan

### nginx: client_max_body_size & limit_req aktif
138:# limit_req_zone harus berada di luar blok server.
140:limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;
150:    client_max_body_size 1m;
159:        limit_req zone=login_limit burst=5 nodelay;
160:        limit_req_status 429;
```
