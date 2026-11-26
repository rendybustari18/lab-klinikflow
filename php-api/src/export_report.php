<?php
// KlinikFlow - Report Export & Document Processing Utility
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/auth.php';

requireInternalUser(['admin', 'manager']);

$rawInput = file_get_contents('php://input');
$jsonInput = json_decode($rawInput, true) ?: [];

$reportType = $jsonInput['type'] ?? $_REQUEST['type'] ?? 'daily_financial';
$format = $jsonInput['format'] ?? $_REQUEST['format'] ?? 'csv';
$filter = $jsonInput['filter'] ?? $_REQUEST['filter'] ?? 'all';

if (!in_array($reportType, ['daily_financial', 'visit_summary', 'claim_reimbursement'], true) ||
    !in_array($format, ['csv', 'text'], true) || !is_string($filter) || strlen($filter) > 200) {
    sendError('Parameter ekspor tidak valid', 400);
}
$rawOutput = "[REPORT EXPORT ENGINE] Tipe: $reportType Filter: $filter Format: $format";

sendJson([
    'success' => true,
    'type' => $reportType,
    'format' => $format,
    'filter' => $filter,
    'generated_at' => date('Y-m-d H:i:s'),
    'output' => trim($rawOutput)
]);

