<?php
/**
 * POST /api/create_match.php
 * Explicitly pair two users (used when matchmaking or direct request is confirmed)
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../database.php';

set_cors_headers();

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$userA = trim($input['user_a_id'] ?? '');
$userB = trim($input['user_b_id'] ?? '');

if (empty($userA) || empty($userB) || $userA === $userB) {
    send_json_response(['success' => false, 'error' => 'Valid user_a_id and user_b_id required'], 400);
}

$db = Database::getConnection();

$matchId = 'mat_' . bin2hex(random_bytes(16));

$stmt = $db->prepare("
    INSERT INTO matches (match_id, user_a_id, user_b_id, user_a_country, user_b_country, status, created_at)
    VALUES (:mid, :ua, :ub, 'Unknown', 'Unknown', 'connecting', NOW())
");
$stmt->execute([':mid' => $matchId, ':ua' => $userA, ':ub' => $userB]);

send_json_response([
    'success' => true,
    'match_id' => $matchId
]);
