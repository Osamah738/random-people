<?php
/**
 * POST /api/find_match.php
 * Real server-side matchmaking queue using MySQL transactions
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../database.php';

set_cors_headers();

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$userId = trim($input['user_id'] ?? '');
$targetCountry = trim($input['target_country'] ?? 'Any');
$myCountry = trim($input['my_country'] ?? '');

if (empty($userId)) {
    send_json_response(['success' => false, 'error' => 'user_id is required'], 400);
}

$db = Database::getConnection();

// Check if user is banned
$ipHash = get_anonymized_ip_hash();
$stmtBan = $db->prepare("
    SELECT * FROM bans 
    WHERE (unique_user_id = :uid OR ip_hash = :ip_hash) 
      AND is_active = 1 
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
");
$stmtBan->execute([':uid' => $userId, ':ip_hash' => $ipHash]);
if ($stmtBan->fetch()) {
    send_json_response(['success' => false, 'banned' => true, 'error' => 'Your account is currently suspended.'], 403);
}

// 1. Check if user is ALREADY placed into an active/connecting match by another peer
$stmtActive = $db->prepare("
    SELECT * FROM matches 
    WHERE (user_a_id = :uid OR user_b_id = :uid) 
      AND status IN ('connecting', 'active') 
    ORDER BY created_at DESC 
    LIMIT 1
");
$stmtActive->execute([':uid' => $userId]);
$existingMatch = $stmtActive->fetch();

if ($existingMatch) {
    $peerId = ($existingMatch['user_a_id'] === $userId) ? $existingMatch['user_b_id'] : $existingMatch['user_a_id'];
    $peerCountry = ($existingMatch['user_a_id'] === $userId) ? $existingMatch['user_b_country'] : $existingMatch['user_a_country'];
    $isInitiator = ($existingMatch['user_a_id'] === $userId);

    send_json_response([
        'success' => true,
        'matched' => true,
        'match_id' => $existingMatch['match_id'],
        'peer_id' => $peerId,
        'peer_country' => $peerCountry,
        'is_initiator' => $isInitiator
    ]);
}

// 2. Otherwise, update user heartbeat and mark status as waiting
$stmtUpdate = $db->prepare("
    UPDATE users 
    SET online_status = 'waiting', 
        country = COALESCE(NULLIF(:country, ''), country),
        last_seen = NOW() 
    WHERE unique_user_id = :uid
");
$stmtUpdate->execute([':country' => $myCountry, ':uid' => $userId]);

// 3. Atomically look for a waiting partner
try {
    $db->beginTransaction();

    // Find candidate waiting users (active within the last 30s)
    $countrySql = "";
    $params = [
        ':uid' => $userId,
        ':timeout' => HEARTBEAT_TIMEOUT_SECONDS
    ];

    if (!empty($targetCountry) && strtolower($targetCountry) !== 'any' && strtolower($targetCountry) !== 'all') {
        $countrySql = " AND country = :target_country";
        $params[':target_country'] = $targetCountry;
    }

    // Exclude the most recent partner to avoid immediate repeat match
    $stmtRecent = $db->prepare("
        SELECT CASE WHEN user_a_id = :uid THEN user_b_id ELSE user_a_id END AS last_peer
        FROM matches 
        WHERE (user_a_id = :uid OR user_b_id = :uid)
        ORDER BY created_at DESC 
        LIMIT 1
    ");
    $stmtRecent->execute([':uid' => $userId]);
    $lastPeer = $stmtRecent->fetchColumn();

    $lastPeerSql = "";
    if ($lastPeer) {
        $lastPeerSql = " AND unique_user_id != :last_peer";
        $params[':last_peer'] = $lastPeer;
    }

    $query = "
        SELECT unique_user_id, country, country_code 
        FROM users 
        WHERE unique_user_id != :uid 
          AND online_status = 'waiting' 
          AND last_seen >= NOW() - INTERVAL :timeout SECOND
          $countrySql
          $lastPeerSql
        ORDER BY last_seen ASC 
        LIMIT 1 
        FOR UPDATE
    ";

    $stmtCandidate = $db->prepare($query);
    $stmtCandidate->execute($params);
    $candidate = $stmtCandidate->fetch();

    // Fallback: if lastPeer was excluded and no candidate found, allow lastPeer if still available
    if (!$candidate && $lastPeer) {
        unset($params[':last_peer']);
        $fallbackQuery = "
            SELECT unique_user_id, country, country_code 
            FROM users 
            WHERE unique_user_id != :uid 
              AND online_status = 'waiting' 
              AND last_seen >= NOW() - INTERVAL :timeout SECOND
              $countrySql
            ORDER BY last_seen ASC 
            LIMIT 1 
            FOR UPDATE
        ";
        $stmtFallback = $db->prepare($fallbackQuery);
        $stmtFallback->execute($params);
        $candidate = $stmtFallback->fetch();
    }

    if ($candidate) {
        $peerId = $candidate['unique_user_id'];
        $peerCountry = $candidate['country'];
        $matchId = 'mat_' . bin2hex(random_bytes(16));

        // Mark both users as 'matched'
        $stmtMark = $db->prepare("
            UPDATE users 
            SET online_status = 'matched' 
            WHERE unique_user_id IN (:uid, :peer)
        ");
        $stmtMark->execute([':uid' => $userId, ':peer' => $peerId]);

        // Insert new match record
        $stmtInsertMatch = $db->prepare("
            INSERT INTO matches (
                match_id, user_a_id, user_b_id, 
                user_a_country, user_b_country, 
                target_country_a, target_country_b, 
                status, created_at
            ) VALUES (
                :mid, :user_a, :user_b, 
                :country_a, :country_b, 
                :target_a, 'Any', 
                'connecting', NOW()
            )
        ");
        $stmtInsertMatch->execute([
            ':mid' => $matchId,
            ':user_a' => $userId,
            ':user_b' => $peerId,
            ':country_a' => $myCountry ?: 'United States',
            ':country_b' => $peerCountry,
            ':target_a' => $targetCountry
        ]);

        $db->commit();

        send_json_response([
            'success' => true,
            'matched' => true,
            'match_id' => $matchId,
            'peer_id' => $peerId,
            'peer_country' => $peerCountry,
            'is_initiator' => true
        ]);
    } else {
        $db->commit();
        // Still waiting in queue
        send_json_response([
            'success' => true,
            'matched' => false,
            'status' => 'waiting',
            'message' => 'Looking for someone...'
        ]);
    }
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    send_json_response([
        'success' => false,
        'error' => 'Matchmaking error: ' . $e->getMessage()
    ], 500);
}
