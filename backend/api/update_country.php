<?php
/**
 * POST /api/update_country.php
 * Updates the user's selected country or origin country
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../database.php';

set_cors_headers();

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$userId = trim($input['user_id'] ?? '');
$country = trim($input['country'] ?? '');
$countryCode = trim($input['country_code'] ?? '');

if (empty($userId) || empty($country)) {
    send_json_response(['success' => false, 'error' => 'user_id and country are required'], 400);
}

$db = Database::getConnection();

$stmt = $db->prepare("
    UPDATE users 
    SET country = :country, 
        country_code = :code, 
        last_seen = NOW() 
    WHERE unique_user_id = :uid
");

$stmt->execute([
    ':country' => $country,
    ':code' => $countryCode ?: 'US',
    ':uid' => $userId
]);

send_json_response([
    'success' => true,
    'country' => $country,
    'country_code' => $countryCode
]);
