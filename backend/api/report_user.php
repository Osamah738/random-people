<?php
/**
 * POST /api/report_user.php
 * Submits a report against a user for inappropriate behavior, nudity, harassment, etc.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../database.php';

set_cors_headers();

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$reporterId = trim($input['reporter_id'] ?? '');
$reportedUserId = trim($input['reported_user_id'] ?? '');
$matchId = trim($input['match_id'] ?? '');
$reason = trim($input['reason'] ?? 'Inappropriate behavior');
$details = trim($input['details'] ?? '');

if (empty($reporterId) || empty($reportedUserId)) {
    send_json_response(['success' => false, 'error' => 'reporter_id and reported_user_id are required'], 400);
}

// Validate reason whitelist
$allowedReasons = [
    'Inappropriate behavior',
    'Harassment',
    'Nudity/sexual content',
    'Spam',
    'Underage / Safety Concern',
    'Other'
];

if (!in_array($reason, $allowedReasons)) {
    $reason = 'Other';
}

$db = Database::getConnection();

$reportId = 'rep_' . bin2hex(random_bytes(16));

$stmt = $db->prepare("
    INSERT INTO reports (report_id, reporter_id, reported_user_id, match_id, reason, details, status, created_at)
    VALUES (:rid, :reporter, :reported, :mid, :reason, :details, 'pending', NOW())
");

$stmt->execute([
    ':rid' => $reportId,
    ':reporter' => $reporterId,
    ':reported' => $reportedUserId,
    ':mid' => $matchId ?: null,
    ':reason' => $reason,
    ':details' => substr($details, 0, 1000)
]);

// Automatically end match if reported during call
if (!empty($matchId)) {
    $stmtEnd = $db->prepare("
        UPDATE matches 
        SET status = 'ended', ended_at = NOW(), ended_by = :reporter 
        WHERE match_id = :mid
    ");
    $stmtEnd->execute([':reporter' => $reporterId, ':mid' => $matchId]);
}

// If user receives multiple pending reports, flag or auto-ban consideration
$stmtCount = $db->prepare("
    SELECT COUNT(*) FROM reports 
    WHERE reported_user_id = :reported AND created_at >= NOW() - INTERVAL 24 HOUR
");
$stmtCount->execute([':reported' => $reportedUserId]);
$recentReportCount = $stmtCount->fetchColumn();

if ($recentReportCount >= 5) {
    // Auto suspension after 5+ rapid reports within 24h
    $banId = 'ban_auto_' . bin2hex(random_bytes(8));
    $stmtAutoBan = $db->prepare("
        INSERT INTO bans (ban_id, unique_user_id, reason, banned_by, is_active, created_at, expires_at)
        VALUES (:bid, :uid, 'Automated temporary ban due to multiple community reports', 'system_moderation', 1, NOW(), NOW() + INTERVAL 24 HOUR)
        ON DUPLICATE KEY UPDATE is_active = 1
    ");
    $stmtAutoBan->execute([':bid' => $banId, ':uid' => $reportedUserId]);
}

send_json_response([
    'success' => true,
    'report_id' => $reportId,
    'message' => 'Thank you. The report has been received and our moderation team will review it.'
]);
