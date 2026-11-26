<?php
// KlinikFlow - PHP Legacy API Router
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (str_starts_with($uri, '/reports/export') || str_starts_with($uri, '/export_report')) {
    require __DIR__ . '/export_report.php';
} elseif (str_starts_with($uri, '/reports')) {
    require __DIR__ . '/reports.php';
} elseif (str_starts_with($uri, '/claims')) {
    require __DIR__ . '/claims.php';
} elseif (str_starts_with($uri, '/attachments')) {
    require __DIR__ . '/attachments.php';
} else {
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'online',
        'service' => 'KlinikFlow Legacy PHP Service v2.0',
        'timestamp' => date('c')
    ]);
}

