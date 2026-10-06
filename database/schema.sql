-- =======================================================
-- OmeLive Random Video Chat - MySQL Database Schema
-- Compatible with MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+
-- =======================================================

CREATE DATABASE IF NOT EXISTS `omelive_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `omelive_db`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `unique_user_id` VARCHAR(64) NOT NULL UNIQUE,
  `country` VARCHAR(64) NOT NULL DEFAULT 'United States',
  `country_code` VARCHAR(8) NOT NULL DEFAULT 'US',
  `ip_hash` VARCHAR(64) NOT NULL,
  `online_status` ENUM('offline', 'waiting', 'matched') NOT NULL DEFAULT 'waiting',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_unique_user_id` (`unique_user_id`),
  INDEX `idx_online_status` (`online_status`),
  INDEX `idx_country` (`country`),
  INDEX `idx_last_seen` (`last_seen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Sessions Table (User connection tracking)
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `session_token` VARCHAR(64) NOT NULL UNIQUE,
  `unique_user_id` VARCHAR(64) NOT NULL,
  `ip_hash` VARCHAR(64) NOT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_activity` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  INDEX `idx_session_token` (`session_token`),
  INDEX `idx_user_session` (`unique_user_id`),
  INDEX `idx_last_activity` (`last_activity`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`unique_user_id`) REFERENCES `users` (`unique_user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Matches Table (Matchmaking sessions between two users)
CREATE TABLE IF NOT EXISTS `matches` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `match_id` VARCHAR(64) NOT NULL UNIQUE,
  `user_a_id` VARCHAR(64) NOT NULL,
  `user_b_id` VARCHAR(64) NOT NULL,
  `user_a_country` VARCHAR(64) NOT NULL,
  `user_b_country` VARCHAR(64) NOT NULL,
  `target_country_a` VARCHAR(64) NOT NULL DEFAULT 'Any',
  `target_country_b` VARCHAR(64) NOT NULL DEFAULT 'Any',
  `status` ENUM('connecting', 'active', 'ended') NOT NULL DEFAULT 'connecting',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` TIMESTAMP NULL DEFAULT NULL,
  `ended_by` VARCHAR(64) DEFAULT NULL,
  INDEX `idx_match_id` (`match_id`),
  INDEX `idx_user_a` (`user_a_id`),
  INDEX `idx_user_b` (`user_b_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Reports Table (User moderation and abuse reports)
CREATE TABLE IF NOT EXISTS `reports` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `report_id` VARCHAR(64) NOT NULL UNIQUE,
  `reporter_id` VARCHAR(64) NOT NULL,
  `reported_user_id` VARCHAR(64) NOT NULL,
  `match_id` VARCHAR(64) DEFAULT NULL,
  `reason` VARCHAR(128) NOT NULL,
  `details` TEXT DEFAULT NULL,
  `status` ENUM('pending', 'reviewed', 'resolved') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_report_id` (`report_id`),
  INDEX `idx_reported_user` (`reported_user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Bans Table (User suspensions and bans)
CREATE TABLE IF NOT EXISTS `bans` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `ban_id` VARCHAR(64) NOT NULL UNIQUE,
  `unique_user_id` VARCHAR(64) NOT NULL,
  `ip_hash` VARCHAR(64) DEFAULT NULL,
  `reason` TEXT NOT NULL,
  `banned_by` VARCHAR(64) NOT NULL DEFAULT 'admin',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NULL DEFAULT NULL,
  INDEX `idx_ban_user` (`unique_user_id`),
  INDEX `idx_ip_hash` (`ip_hash`),
  INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample administrative seed data
INSERT INTO `users` (`unique_user_id`, `country`, `country_code`, `ip_hash`, `online_status`, `created_at`, `last_seen`)
VALUES
  ('demo-system-moderator', 'United States', 'US', SHA2('127.0.0.1_salt', 256), 'offline', NOW(), NOW())
ON DUPLICATE KEY UPDATE `last_seen` = NOW();
