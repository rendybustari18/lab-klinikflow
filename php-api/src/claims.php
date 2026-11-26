<?php
// KlinikFlow - Insurance Claims Handler
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/auth.php';

$action = $_GET['action'] ?? 'list';
$user = requireInternalUser($action === 'approve' ? ['admin', 'manager'] : ['admin', 'manager', 'staff', 'cashier']);

switch ($action) {
    case 'list':
        handleListClaims($pdo, $user['clinic_id']);
        break;

    case 'approve':
        handleApproveClaim($pdo, $user);
        break;

    case 'detail':
        handleClaimDetail($pdo, $user['clinic_id']);
        break;

    default:
        sendError('Aksi klaim tidak valid', 404);
}

function handleListClaims($pdo, $clinicId) {
    $query = "SELECT c.*, cl.name as clinic_name, i.invoice_number, p.full_name as patient_name
              FROM claims c
              JOIN clinics cl ON c.clinic_id = cl.id
              JOIN invoices i ON c.invoice_id = i.id
              JOIN patients p ON i.patient_id = p.id
              WHERE 1=1";
    $query .= " AND c.clinic_id = ?";
    $params = [$clinicId];

    $query .= " ORDER BY c.id DESC";
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $claims = $stmt->fetchAll();

    sendJson([
        'success' => true,
        'data' => $claims
    ]);
}

function handleClaimDetail($pdo, $clinicId) {
    $claimId = $_GET['id'] ?? null;
    if (!$claimId) {
        sendError('Parameter id klaim diperlukan', 400);
    }

    $stmt = $pdo->prepare("SELECT c.*, cl.name as clinic_name, i.invoice_number, p.full_name as patient_name
                           FROM claims c
                           JOIN clinics cl ON c.clinic_id = cl.id
                           JOIN invoices i ON c.invoice_id = i.id
                           JOIN patients p ON i.patient_id = p.id
                           WHERE c.id = ? AND c.clinic_id = ?");
    $stmt->execute([$claimId, $clinicId]);
    $claim = $stmt->fetch();

    if (!$claim) {
        sendError('Data klaim tidak ditemukan', 404);
    }

    // Ambil lampiran berkas klaim
    $attStmt = $pdo->prepare("SELECT id, attachment_uuid, file_name, file_type, uploaded_at FROM claim_attachments WHERE claim_id = ?");
    $attStmt->execute([$claimId]);
    $claim['attachments'] = $attStmt->fetchAll();

    sendJson([
        'success' => true,
        'data' => $claim
    ]);
}

function handleApproveClaim($pdo, $user) {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $claimId = $input['claim_id'] ?? $_GET['claim_id'] ?? null;

    if (!filter_var($claimId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) {
        sendError('Parameter claim_id wajib disertakan', 400);
    }

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("SELECT invoice_id FROM claims WHERE id = ? AND clinic_id = ?");
        $stmt->execute([$claimId, $user['clinic_id']]);
        $claimRef = $stmt->fetch();
        if (!$claimRef) {
            $pdo->rollBack();
            sendError('Klaim tidak ditemukan', 404);
        }
        $invoiceStmt = $pdo->prepare("SELECT * FROM invoices WHERE id = ? AND clinic_id = ? FOR UPDATE");
        $invoiceStmt->execute([$claimRef['invoice_id'], $user['clinic_id']]);
        $invoice = $invoiceStmt->fetch();
        $stmt = $pdo->prepare("SELECT * FROM claims WHERE id = ? AND clinic_id = ? FOR UPDATE");
        $stmt->execute([$claimId, $user['clinic_id']]);
        $claim = $stmt->fetch();
        if (!$invoice || !$claim || (int)$claim['invoice_id'] !== (int)$invoice['id'] ||
            $claim['status'] !== 'submitted' || !in_array($invoice['status'], ['unpaid', 'partially_paid'], true)) {
            $pdo->rollBack();
            sendError('Status klaim atau tagihan tidak dapat diproses', 409);
        }
        $paidStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = ? AND settlement_status = 'settled'");
        $paidStmt->execute([$invoice['id']]);
        $outstanding = (int)round((float)$invoice['amount'] * 100) - (int)round((float)$paidStmt->fetchColumn() * 100);
        if ($outstanding <= 0 || (int)round((float)$claim['amount'] * 100) !== $outstanding) {
            $pdo->rollBack();
            sendError('Nominal klaim harus sama dengan sisa tagihan', 409);
        }
        $payment = $pdo->prepare("INSERT INTO payments (payment_ref, invoice_id, amount, method, settlement_status, paid_at) VALUES (?, ?, ?, 'insurance', 'settled', NOW())");
        $payment->execute(['CLM-' . bin2hex(random_bytes(16)), $invoice['id'], $claim['amount']]);
        $pdo->prepare("UPDATE claims SET status = 'approved', approved_at = NOW() WHERE id = ?")->execute([$claimId]);
        $pdo->prepare("UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = ?")->execute([$invoice['id']]);
        $pdo->prepare("INSERT INTO audit_log (actor_id, clinic_id, action, entity_type, entity_id) VALUES (?, ?, 'claim.approve', 'claim', ?)")
            ->execute([$user['id'], $user['clinic_id'], $claimId]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Claim approval failed: ' . $error->getMessage());
        sendError('Approval klaim gagal', 500);
    }

    sendJson([
        'success' => true,
        'message' => "Klaim {$claim['claim_number']} berhasil disetujui dan dicatat sebesar Rp " . number_format($claim['amount'], 0, ',', '.'),
        'claim_id' => $claimId,
        'claim_number' => $claim['claim_number'],
        'amount' => floatval($claim['amount']),
        'previous_status' => $claim['status'],
        'current_status' => 'approved'
    ]);
}

