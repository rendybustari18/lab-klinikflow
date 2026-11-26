<?php
// KlinikFlow - Claim Attachment & Document Service
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/auth.php';

$user = requireInternalUser(['admin', 'manager', 'staff', 'cashier']);
$action = $_GET['action'] ?? 'get';

switch ($action) {
    case 'get':
        handleGetAttachment($pdo, $user['clinic_id']);
        break;

    case 'list':
        handleListAttachments($pdo, $user['clinic_id']);
        break;

    default:
        sendError('Aksi lampiran tidak valid', 404);
}

function handleGetAttachment($pdo, $clinicId) {
    $uuid = $_GET['uuid'] ?? null;
    if (!$uuid) {
        sendError('Parameter attachment uuid diperlukan', 400);
    }

    $stmt = $pdo->prepare("SELECT a.id, a.attachment_uuid, a.file_name, a.file_type, a.uploaded_at, c.claim_number, c.insurance_name, c.amount as claim_amount, c.clinic_id, cl.name as clinic_name
                           FROM claim_attachments a
                           JOIN claims c ON a.claim_id = c.id
                           JOIN clinics cl ON c.clinic_id = cl.id
                           WHERE a.attachment_uuid = ? AND c.clinic_id = ?");
    $stmt->execute([$uuid, $clinicId]);
    $attachment = $stmt->fetch();

    if (!$attachment) {
        sendError('Dokumen lampiran tidak ditemukan', 404);
    }

    sendJson([
        'success' => true,
        'data' => $attachment
    ]);
}

function handleListAttachments($pdo, $clinicId) {
    $stmt = $pdo->prepare("SELECT a.id, a.attachment_uuid, a.file_name, a.file_type, a.uploaded_at, c.claim_number, cl.name as clinic_name
                         FROM claim_attachments a
                         JOIN claims c ON a.claim_id = c.id
                         JOIN clinics cl ON c.clinic_id = cl.id
                         WHERE c.clinic_id = ? ORDER BY a.id ASC");
    $stmt->execute([$clinicId]);
    $attachments = $stmt->fetchAll();

    sendJson([
        'success' => true,
        'data' => $attachments
    ]);
}

