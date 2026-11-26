<?php
// KlinikFlow - Financial & Visit Report Generation
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/auth.php';
require_once __DIR__ . '/helpers/pagination.php';

$user = requireInternalUser(['admin', 'manager']);
$filterQuery = $_GET['filter'] ?? $_GET['search'] ?? '';
$pagination = getPagination();

// Ambil ringkasan laporan tagihan dan kunjungan
$from = " FROM invoices i
          JOIN patients p ON i.patient_id = p.id
          JOIN clinics c ON i.clinic_id = c.id
          JOIN visits v ON i.visit_id = v.id
          WHERE 1=1";
$params = [];

$from .= " AND i.clinic_id = ?";
$params[] = $user['clinic_id'];

if (!empty($filterQuery)) {
    $from .= " AND (p.full_name LIKE ? OR i.invoice_number LIKE ?)";
    $params[] = "%$filterQuery%";
    $params[] = "%$filterQuery%";
}

$countStmt = $pdo->prepare("SELECT COUNT(*)" . $from);
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$query = "SELECT i.id, i.invoice_number, i.amount, i.status, p.full_name as patient_name, p.mrn,
                 c.name as clinic_name, v.doctor_name, v.visit_date" . $from . " ORDER BY i.id DESC";
$records = fetchPage($pdo, $query, $params, $pagination);

$summaryMessage = !empty($filterQuery) 
    ? "Menampilkan arsip laporan transaksi untuk kata kunci: " . $filterQuery 
    : "Menampilkan seluruh arsip laporan operasional klinik";

sendJson([
    'success' => true,
    'filter' => $filterQuery,
    // Ringkasan dikirim sebagai teks biasa; klien wajib merendernya sebagai teks.
    'summary' => $summaryMessage,
    'total_records' => $total,
    'data' => $records,
    'pagination' => paginationMeta($pagination, $total)
]);

