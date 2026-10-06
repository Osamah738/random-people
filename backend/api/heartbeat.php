<?php
/**
 * POST /api/heartbeat.php
 * Heartbeat keeper and queue garbage collector
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../database.php';

set_cors_headers();

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$userId = trim($input['user_id'] ?? '');

if (empty($userId)) {
    send_json_response(['success' => false, 'error' => 'user_id is required'], 400);
}

$db = Database::getConnection();

// Update heartbeat
$stmt = $db->prepare("
    UPDATE users 
    SET last_seen = NOW() 
    WHERE unique_user_id = :uid
");
$stmt->execute([':uid' => $userId]);

// Housekeeping: mark users who missed heartbeats as offline (older than 30s)
$stmtClean = $db->prepare("
    UPDATE users 
    SET online_status = 'offline' 
    WHERE online_status != 'offline' 
      AND last_seen < NOW() - INTERVAL :timeout SECOND
");
$stmtClean->execute([':timeout' => HEARTBEAT_TIMEOUT_SECONDS]);

// Close matches where one participant went offline
$stmtCleanMatches = $db->prepare("
    UPDATE matches m
    JOIN users u ON (m.user_a_id = u.unique_user_id OR m.user_b_id = u.unique_user_id)
    SET m.status = 'ended', m.ended_at = NOW(), m.ended_by = 'system_timeout'
    WHERE m.status IN ('connecting', 'active')
      AND u.online_status = 'offline'
");
$stmtCleanMatches->execute();

// Check if current user is still in a match
$stmtMatch = $db->prepare("
    SELECT match_id, user_a_id, user_b_id, status 
    FROM matches 
    WHERE (user_a_id = :uid OR user_b_id = :uid) 
      AND status IN ('connecting', 'active') 
    LIMIT 1
");
$stmtMatch->execute([':uid' => $userId]);
$activeMatch = $stmtMatch->fetch();

send_json_response([
    'success' => true,
    'in_match' => (bool)$activeMatch,
    'match' => $activeMatch ?: null
]);
