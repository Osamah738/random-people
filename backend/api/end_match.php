<?php
/**
 * POST /api/end_match.php
 * Ends the active match, cleans up user statuses, and returns them to matchmaking
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../database.php';

set_cors_headers();

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$userId = trim($input['user_id'] ?? '');
$matchId = trim($input['match_id'] ?? '');

if (empty($userId)) {
    send_json_response(['success' => false, 'error' => 'user_id is required'], 400);
}

$db = Database::getConnection();

// 1. End any active match for this match_id or user
if (!empty($matchId)) {
    $stmtEnd = $db->prepare("
        UPDATE matches 
        SET status = 'ended', 
            ended_at = NOW(), 
            ended_by = :uid 
        WHERE match_id = :mid AND status IN ('connecting', 'active')
    ");
    $stmtEnd->execute([':uid' => $userId, ':mid' => $matchId]);
} else {
    $stmtEnd = $db->prepare("
        UPDATE matches 
        SET status = 'ended', 
            ended_at = NOW(), 
            ended_by = :uid 
        WHERE (user_a_id = :uid OR user_b_id = :uid) AND status IN ('connecting', 'active')
    ");
    $stmtEnd->execute([':uid' => $userId]);
}

// 2. Put user back in 'waiting' queue
$stmtReset = $db->prepare("
    UPDATE users 
    SET online_status = 'waiting', 
        last_seen = NOW() 
    WHERE unique_user_id = :uid
");
$stmtReset->execute([':uid' => $userId]);

send_json_response([
    'success' => true,
    'message' => 'Match ended successfully. User is now available for next partner.'
]);
