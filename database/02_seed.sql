-- KlinikFlow Database Seed Data
-- Local Security Training Lab - Data Dummy

-- 1. Clinics
INSERT INTO clinics (id, name, code, address, phone) VALUES
(1, 'Klinik Mentari', 'KLN-001', 'Jl. Surya Kencana No. 10, Jakarta Selatan', '021-7788990'),
(2, 'Klinik Sehat Sentosa', 'KLN-002', 'Jl. Boulevard Raya Blok AA No. 5, Surabaya', '031-5566778');

-- 2. Users (Password: password123 -> $2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6)
INSERT INTO users (id, clinic_id, name, email, password, role, phone) VALUES
(1, 1, 'dr. Farhan Malik (Admin Medis)', 'admin@klinikflow.local', '$2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6', 'admin', '0811990001'),
(2, 1, 'Siti Rahayu (Koordinator Ops)', 'manager@klinikflow.local', '$2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6', 'manager', '0812990002'),
(3, 1, 'Doni Pratama (Staf Pendaftaran 1)', 'staf1@klinikflow.local', '$2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6', 'staff', '0813990003'),
(4, 2, 'Lia Anggraini (Staf Pendaftaran 2)', 'staf2@klinikflow.local', '$2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6', 'staff', '0814990004'),
(5, 1, 'Maya Melinda (Kasir 1)', 'kasir1@klinikflow.local', '$2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6', 'cashier', '0815990005'),
(6, 2, 'Fajar Nugraha (Kasir 2)', 'kasir2@klinikflow.local', '$2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6', 'cashier', '0816990006'),
(7, 1, 'Bambang Susanto', 'pasien1@pasien.local', '$2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6', 'patient', '0812111101'),
(8, 1, 'Ratna Sari', 'pasien2@pasien.local', '$2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6', 'patient', '0812111102'),
(9, 2, 'Agus Haryanto', 'pasien3@pasien.local', '$2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6', 'patient', '0813222203'),
(10, 2, 'Nurul Hidayah', 'pasien4@pasien.local', '$2y$12$bz350OlJuLRL/eGWYtjcPuej9dtTupKuMMxQxxz2lbaJ6kcdl3nm6', 'patient', '0813222204');

-- 3. Patients (4 Dummy records)
INSERT INTO patients (id, clinic_id, mrn, full_name, birth_date, gender, phone, address) VALUES
(1, 1, 'MRN-2026-001', 'Bambang Susanto', '1985-04-12', 'L', '0812111101', 'Jl. Kemang Timur No. 14, Mampang Prapatan, Jakarta Selatan'),
(2, 1, 'MRN-2026-002', 'Ratna Sari', '1992-08-23', 'P', '0812111102', 'Jl. Radio Dalam Raya No. 8B, Kebayoran Baru, Jakarta Selatan'),
(3, 2, 'MRN-2026-003', 'Agus Haryanto', '1980-11-05', 'L', '0813222203', 'Jl. Rungkut Asri Timur No. 22, Rungkut, Surabaya'),
(4, 2, 'MRN-2026-004', 'Nurul Hidayah', '1995-02-17', 'P', '0813222204', 'Jl. Darmo Permai Selatan No. 50, Sukomanunggal, Surabaya');

-- 4. Services (10 items)
INSERT INTO services (id, clinic_id, code, name, category, fee, is_active) VALUES
(1, 1, 'SVC-001', 'Konsultasi Dokter Umum', 'Konsultasi', 75000.00, 1),
(2, 1, 'SVC-002', 'Tindakan Medis Ringan & Hecting', 'Tindakan', 150000.00, 1),
(3, 1, 'SVC-003', 'Terapi Inhalasi / Nebulizer', 'Tindakan', 90000.00, 1),
(4, 1, 'SVC-004', 'Pemeriksaan Gula Darah & Kolesterol', 'Laboratorium', 60000.00, 1),
(5, 1, 'SVC-005', 'Rawat Luka & Ganti Verban', 'Tindakan', 50000.00, 1),
(6, 2, 'SVC-006', 'Fisioterapi Dasar & TENS', 'Fisioterapi', 120000.00, 1),
(7, 2, 'SVC-007', 'Imunisasi & Vaksinasi Dewasa', 'Imunisasi', 180000.00, 1),
(8, 2, 'SVC-008', 'Rekam Jantung / EKG Dasar', 'Diagnostik', 135000.00, 1),
(9, 2, 'SVC-009', 'Pembersihan Telinga / Spooling', 'Tindakan', 85000.00, 1),
(10, 2, 'SVC-010', 'Surat Keterangan Sehat & Buta Warna', 'Administrasi', 45000.00, 1);

-- 5. Visits (8 records)
INSERT INTO visits (id, visit_uuid, clinic_id, patient_id, doctor_name, visit_date, status, notes) VALUES
(1, 'vis-9a1b-c1d2e3f4-0001', 1, 1, 'dr. Aris Wibowo', DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'settled', 'Keluhan demam 3 hari, flu, dan batuk kering.'),
(2, 'vis-9a1b-c1d2e3f4-0002', 1, 1, 'dr. Aris Wibowo', DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'billed', 'Kontrol lanjutan pasca demam, evaluasi nafsu makan.'),
(3, 'vis-9a1b-c1d2e3f4-0003', 1, 2, 'dr. Indah Permata', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'examined', 'Luka robek ringan di jari tangan kiri, butuh 2 jahitan.'),
(4, 'vis-9a1b-c1d2e3f4-0004', 1, 2, 'dr. Indah Permata', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'registered', 'Pemeriksaan tensi rutin dan konsultasi diet sehat.'),
(5, 'vis-8f2c-e4b5a6c7-0005', 2, 3, 'dr. Hendra Saputra', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'settled', 'Nyeri punggung bawah pasca angkat beban berat.'),
(6, 'vis-8f2c-e4b5a6c7-0006', 2, 3, 'dr. Hendra Saputra', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'billed', 'Sesi lanjutan fisioterapi stimulasi elektrik.'),
(7, 'vis-8f2c-e4b5a6c7-0007', 2, 4, 'dr. Maya Kusuma', DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'settled', 'Permohonan surat keterangan sehat untuk melamar kerja.'),
(8, 'vis-8f2c-e4b5a6c7-0008', 2, 4, 'dr. Maya Kusuma', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'cancelled', 'Pasien berhalangan hadir pada jam praktek sore.');

-- 6. Invoices (8 records)
INSERT INTO invoices (id, invoice_number, visit_id, clinic_id, patient_id, amount, status, issued_at, paid_at) VALUES
(1, 'INV-2026-0001', 1, 1, 1, 225000.00, 'paid', DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY)),
(2, 'INV-2026-0002', 2, 1, 1, 165000.00, 'partially_paid', DATE_SUB(NOW(), INTERVAL 3 DAY), NULL),
(3, 'INV-2026-0003', 3, 1, 2, 75000.00, 'unpaid', DATE_SUB(NOW(), INTERVAL 2 DAY), NULL),
(4, 'INV-2026-0004', 4, 1, 2, 150000.00, 'unpaid', DATE_SUB(NOW(), INTERVAL 1 DAY), NULL),
(5, 'INV-2026-0005', 5, 2, 3, 210000.00, 'paid', DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
(6, 'INV-2026-0006', 6, 2, 3, 135000.00, 'partially_paid', DATE_SUB(NOW(), INTERVAL 2 DAY), NULL),
(7, 'INV-2026-0007', 7, 2, 4, 180000.00, 'paid', DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY)),
(8, 'INV-2026-0008', 8, 2, 4, 45000.00, 'cancelled', DATE_SUB(NOW(), INTERVAL 1 DAY), NULL);

-- 7. Invoice Items
INSERT INTO invoice_items (id, invoice_id, service_id, quantity, unit_price, total_price) VALUES
(1, 1, 1, 1, 75000.00, 75000.00),
(2, 1, 2, 1, 150000.00, 150000.00),
(3, 2, 1, 1, 75000.00, 75000.00),
(4, 2, 3, 1, 90000.00, 90000.00),
(5, 3, 1, 1, 75000.00, 75000.00),
(6, 4, 2, 1, 150000.00, 150000.00),
(7, 5, 6, 1, 120000.00, 120000.00),
(8, 5, 3, 1, 90000.00, 90000.00),
(9, 6, 8, 1, 135000.00, 135000.00),
(10, 7, 7, 1, 180000.00, 180000.00),
(11, 8, 10, 1, 45000.00, 45000.00);

-- 8. Payments (5 records)
INSERT INTO payments (id, payment_ref, invoice_id, amount, method, settlement_status, paid_at) VALUES
(1, 'PAY-2026-0001', 1, 225000.00, 'cash', 'settled', DATE_SUB(NOW(), INTERVAL 8 DAY)),
(2, 'PAY-2026-0002', 5, 210000.00, 'qris', 'settled', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(3, 'PAY-2026-0003', 7, 180000.00, 'bank_transfer', 'settled', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(4, 'PAY-2026-0004', 2, 100000.00, 'qris', 'settled', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(5, 'PAY-2026-0005', 6, 50000.00, 'cash', 'settled', DATE_SUB(NOW(), INTERVAL 2 DAY));

-- 9. Claims (4 records)
INSERT INTO claims (id, claim_uuid, clinic_id, invoice_id, claim_number, insurance_name, amount, status, notes, submitted_at, approved_at) VALUES
(1, 'clm-b7a1-89fc-0001', 1, 1, 'CLM-2026-001', 'BPJS Kesehatan Mandiri', 225000.00, 'approved', 'Klaim tindakan poliklinik disetujui penuh.', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY)),
(2, 'clm-b7a1-89fc-0002', 1, 2, 'CLM-2026-002', 'Asuransi Sehat Utama', 65000.00, 'submitted', 'Menunggu verifikasi dokumen pendukung resep.', DATE_SUB(NOW(), INTERVAL 2 DAY), NULL),
(3, 'clm-c8b2-90ad-0003', 2, 5, 'CLM-2026-003', 'Asuransi Prima Medika', 210000.00, 'approved', 'Reimbursement biaya fisioterapi dan nebulizer.', DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
(4, 'clm-c8b2-90ad-0004', 2, 6, 'CLM-2026-004', 'Asuransi Bersama Raya', 85000.00, 'draft', 'Draft pengajuan klaim diagnostik EKG.', DATE_SUB(NOW(), INTERVAL 1 DAY), NULL);

-- 10. Claim Attachments (6 records)
INSERT INTO claim_attachments (id, attachment_uuid, claim_id, file_name, file_type, file_path, uploaded_by, uploaded_at) VALUES
(1, 'att-f1a2-3b4c-0001', 1, 'berkas_klaim_bambang_01.pdf', 'application/pdf', '/uploads/claims/berkas_klaim_bambang_01.pdf', 3, DATE_SUB(NOW(), INTERVAL 7 DAY)),
(2, 'att-f1a2-3b4c-0002', 1, 'resep_dokter_01.jpg', 'image/jpeg', '/uploads/claims/resep_dokter_01.jpg', 3, DATE_SUB(NOW(), INTERVAL 7 DAY)),
(3, 'att-f1a2-3b4c-0003', 2, 'surat_rujukan_02.pdf', 'application/pdf', '/uploads/claims/surat_rujukan_02.pdf', 3, DATE_SUB(NOW(), INTERVAL 2 DAY)),
(4, 'att-e5d6-7c8b-0004', 3, 'billing_fisioterapi_05.pdf', 'application/pdf', '/uploads/claims/billing_fisioterapi_05.pdf', 4, DATE_SUB(NOW(), INTERVAL 4 DAY)),
(5, 'att-e5d6-7c8b-0005', 3, 'surat_jaminan_05.pdf', 'application/pdf', '/uploads/claims/surat_jaminan_05.pdf', 4, DATE_SUB(NOW(), INTERVAL 4 DAY)),
(6, 'att-e5d6-7c8b-0006', 4, 'draft_ekg_summary_06.pdf', 'application/pdf', '/uploads/claims/draft_ekg_summary_06.pdf', 4, DATE_SUB(NOW(), INTERVAL 1 DAY));
