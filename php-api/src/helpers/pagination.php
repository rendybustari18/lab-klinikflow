<?php
// T22: paginasi daftar. ?page (mulai 1) dan ?limit (default 20, maksimum 100).
require_once __DIR__ . '/response.php';

const PAGINATION_DEFAULT_LIMIT = 20;
const PAGINATION_MAX_LIMIT = 100;

function getPagination(): array {
    $pageRaw = $_GET['page'] ?? '1';
    $limitRaw = $_GET['limit'] ?? (string)PAGINATION_DEFAULT_LIMIT;
    if (!is_string($pageRaw) || !is_string($limitRaw) ||
        !preg_match('/^\d{1,6}$/', $pageRaw) || !preg_match('/^\d{1,6}$/', $limitRaw) ||
        (int)$pageRaw < 1 || (int)$limitRaw < 1) {
        sendError('Parameter page dan limit harus bilangan bulat positif', 400);
    }
    $page = (int)$pageRaw;
    $limit = min((int)$limitRaw, PAGINATION_MAX_LIMIT);
    return ['page' => $page, 'limit' => $limit, 'offset' => ($page - 1) * $limit];
}

function paginationMeta(array $pagination, int $total): array {
    return [
        'page' => $pagination['page'],
        'limit' => $pagination['limit'],
        'total' => $total,
        'total_pages' => max(1, (int)ceil($total / $pagination['limit'])),
    ];
}

// Menjalankan query dengan parameter posisi biasa ditambah LIMIT/OFFSET bertipe integer.
function fetchPage(PDO $pdo, string $query, array $params, array $pagination): array {
    $stmt = $pdo->prepare($query . ' LIMIT ? OFFSET ?');
    $position = 1;
    foreach ($params as $value) {
        $stmt->bindValue($position++, $value);
    }
    $stmt->bindValue($position++, $pagination['limit'], PDO::PARAM_INT);
    $stmt->bindValue($position, $pagination['offset'], PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
}
