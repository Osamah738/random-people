<?php
/**
 * OmeLive Video Chat - Database Connection Wrapper
 * Uses PDO with Prepared Statements for maximum SQL Injection security
 */

require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $dsn = sprintf(
                "mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4",
                DB_HOST,
                DB_PORT,
                DB_NAME
            );

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ];

            try {
                self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);
            } catch (PDOException $e) {
                // Never expose database password or host in error response
                error_log("Database connection error: " . $e->getMessage());
                send_json_response([
                    'success' => false,
                    'error' => 'Database connection failed. Please ensure MySQL is running and configured.'
                ], 500);
            }
        }

        return self::$instance;
    }
}
