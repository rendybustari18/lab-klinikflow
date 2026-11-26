<?php
require_once __DIR__ . '/response.php';

function requireInternalUser(array $roles): array {
    $secret = getenv('INTERNAL_AUTH_SECRET') ?: '';
    $timestamp = $_SERVER['HTTP_X_INTERNAL_TIMESTAMP'] ?? '';
    $signature = $_SERVER['HTTP_X_INTERNAL_SIGNATURE'] ?? '';
    $userId = $_SERVER['HTTP_X_USER_ID'] ?? '';
    $role = $_SERVER['HTTP_X_USER_ROLE'] ?? '';
    $clinicId = $_SERVER['HTTP_X_CLINIC_ID'] ?? '';
    if (strlen($secret) < 32 || !ctype_digit($timestamp) || abs(time() - (int)$timestamp) > 30 ||
        !ctype_digit($userId) || (int)$userId < 1 || !ctype_digit($clinicId) || (int)$clinicId < 1 ||
        !in_array($role, ['admin', 'manager', 'staff', 'cashier', 'patient'], true)) {
        sendError('Akses ditolak', 401);
    }
    $canonical = implode("\n", [$_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'], $timestamp,
        $userId, $role, $clinicId, hash('sha256', file_get_contents('php://input'))]);
    if (!hash_equals(hash_hmac('sha256', $canonical, $secret), $signature)) {
        sendError('Akses ditolak', 401);
    }
    if (!in_array($role, $roles, true)) sendError('Akses ditolak', 403);
    return ['id' => (int)$userId, 'role' => $role, 'clinic_id' => (int)$clinicId];
}