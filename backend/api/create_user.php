<?php
/**
 * POST /api/create_user.php
 * Registers a new visitor or retrieves existing visitor session
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../database.php';

set_cors_headers();

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$userId = trim($input['user_id'] ?? '');
$country = trim($input['country'] ?? 'United States');
$countryCode = trim($input['country_code'] ?? 'US');
$ipHash = get_anonymized_ip_hash();

if (empty($userId)) {
    // Generate secure random unique user ID
    $userId = 'usr_' . bin2hex(random_bytes(16));
} else {
    // Validate format
    if (!preg_match('/^[a-zA-Z0-9_-]{10,64}$/', $userId)) {
        send_json_response(['success' => false, 'error' => 'Invalid user ID format'], 400);
    }
}

$db = Database::getConnection();

// Check if user is banned
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

// Insert or update user
$stmt = $db->prepare("
    INSERT INTO users (unique_user_id, country, country_code, ip_hash, online_status, created_at, last_seen)
    VALUES (:uid, :country, :code, :ip_hash, 'waiting', NOW(), NOW())
    ON DUPLICATE KEY UPDATE 
        country = VALUES(country),
        country_code = VALUES(country_code),
        online_status = 'waiting',
        last_seen = NOW()
");

$stmt->execute([
    ':uid' => $userId,
    ':country' => $country,
    ':code' => $countryCode,
    ':ip_hash' => $ipHash
]);

// Create session token
$sessionToken = 'sess_' . bin2hex(random_bytes(24));
$stmtSess = $db->prepare("
    INSERT INTO sessions (session_token, unique_user_id, ip_hash, user_agent, created_at, last_activity, is_active)
    VALUES (:token, :uid, :ip_hash, :ua, NOW(), NOW(), 1)
");
$stmtSess->execute([
    ':token' => $sessionToken,
    ':uid' => $userId,
    ':ip_hash' => $ipHash,
    ':ua' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255)
]);

send_json_response([
    'success' => true,
    'user_id' => $userId,
    'session_token' => $sessionToken,
    'country' => $country,
    'country_code' => $countryCode
]);
