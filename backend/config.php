<?php
/**
 * OmeLive Video Chat - Backend Configuration
 * Secure credentials and application settings
 */

// Database credentials
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'omelive_db');
define('DB_USER', getenv('DB_USER') ?: 'omelive_user');
define('DB_PASS', getenv('DB_PASS') ?: 'secure_password_here');
define('DB_PORT', getenv('DB_PORT') ?: '3306');

// Application Secret for IP Hashing (protecting user privacy)
define('APP_SECRET_SALT', getenv('APP_SECRET_SALT') ?: 'omelive_secure_salt_984f828a1c');

// Heartbeat & matchmaking limits (seconds)
define('HEARTBEAT_TIMEOUT_SECONDS', 30);
define('ADMIN_SECRET_KEY', getenv('ADMIN_SECRET_KEY') ?: 'admin12345');

// STUN / TURN servers config
define('STUN_SERVERS', [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
]);

// CORS Headers helper
function set_cors_headers() {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    header("Content-Type: application/json; charset=UTF-8");
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// Client IP masking helper (never store raw IP in database)
function get_anonymized_ip_hash() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $forwarded = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($forwarded[0]);
    }
    return hash('sha256', $ip . '_' . APP_SECRET_SALT);
}

// JSON response helper
function send_json_response($data, $status_code = 200) {
    http_response_code($status_code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}
