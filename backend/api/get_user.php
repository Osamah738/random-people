<?php
/**
 * GET /api/get_user.php?user_id=...
 * Fetch user details, online status, and ban verification
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../database.php';

set_cors_headers();

$userId = trim($_GET['user_id'] ?? '');

if (empty($userId)) {
    send_json_response(['success' => false, 'error' => 'user_id is required'], 400);
}

$db = Database::getConnection();

// Check ban
$ipHash = get_anonymized_ip_hash();
$stmtBan = $db->prepare("
    SELECT * FROM bans 
    WHERE (unique_user_id = :uid OR ip_hash = :ip_hash) 
      AND is_active = 1 
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
");
$stmtBan->execute([':uid' => $userId, ':ip_hash' => $ipHash]);
$ban = $stmtBan->fetch();

if ($ban) {
    send_json_response([
        'success' => false,
        'banned' => true,
        'reason' => $ban['reason'],
        'expires_at' => $ban['expires_at']
    ], 403);
}

$stmt = $db->prepare("SELECT unique_user_id, country, country_code, online_status, created_at, last_seen FROM users WHERE unique_user_id = :uid LIMIT 1");
$stmt->execute([':uid' => $userId]);
$user = $stmt->fetch();

if (!$user) {
    send_json_response(['success' => false, 'error' => 'User not found'], 404);
}

send_json_response([
    'success' => true,
    'user' => $user
]);
