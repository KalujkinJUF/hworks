-- ============================================================
-- Голосовые каналы (Фаза 2 голоса)
-- Применить привилегированным пользователем (root/HeidiSQL) на ОБЕИХ БД:
--   XAMPP 3306 (локалка) и MariaDB 3307 (боевой) — приложение под hworks_user без DDL.
-- Идемпотентно (MariaDB поддерживает IF NOT EXISTS для ADD COLUMN).
-- База: social-network
-- ============================================================

ALTER TABLE group_channels ADD COLUMN IF NOT EXISTS type ENUM('text', 'voice') DEFAULT 'text';
