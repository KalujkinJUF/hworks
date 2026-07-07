-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_hash VARCHAR(255) UNIQUE DEFAULT NULL,
    email_code VARCHAR(255) DEFAULT NULL,
    role ENUM('newbie', 'user', 'premium', 'vip', 'moderator', 'admin', 'banned') DEFAULT 'newbie',
    verified TINYINT(1) DEFAULT 0,
    avatar VARCHAR(255) DEFAULT NULL,
    about TEXT DEFAULT NULL,
    user_status ENUM('online', 'offline', 'away', 'dnd') DEFAULT 'offline',
    custom_status ENUM('online', 'offline', 'away', 'dnd') DEFAULT 'online',
    token_version INT NOT NULL DEFAULT 0,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица постов
CREATE TABLE IF NOT EXISTS posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    type ENUM('news', 'patch_note') DEFAULT 'news',
    image_url VARCHAR(255) DEFAULT NULL,
    media TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица для хранения друзей
CREATE TABLE IF NOT EXISTS friends (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    friend_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (user_id, friend_id),
    INDEX idx_user_id (user_id),
    INDEX idx_friend_id (friend_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица для хранения сообщений
CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255) DEFAULT NULL,
    reply_to INT DEFAULT NULL,
    media TEXT DEFAULT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sender_id (sender_id),
    INDEX idx_receiver_id (receiver_id),
    INDEX idx_receiver_read (receiver_id, is_read),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица подписок
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_subscription (follower_id, following_id),
    INDEX idx_following_id (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица лайков
CREATE TABLE IF NOT EXISTS likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (user_id, post_id),
    INDEX idx_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица комментариев
CREATE TABLE IF NOT EXISTS comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    target_id INT NOT NULL,
    target_type ENUM('post', 'profile') NOT NULL,
    content TEXT NOT NULL,
    parent_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_target (target_id, target_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Корректировка default для поля about в существующей таблице
ALTER TABLE users MODIFY COLUMN about TEXT DEFAULT NULL;

-- Добавление колонки прочтения для личных сообщений
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read TINYINT(1) DEFAULT 0;

-- Новые колонки для отзывов на стене и удаления аккаунта
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_viewed_wall TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS delete_code VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_status ENUM('online', 'offline', 'away', 'dnd') DEFAULT 'online';
-- Версия токена для отзыва JWT-сессий (смена пароля инкрементирует значение)
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
-- #22 Ответы в ЛС: ссылка на сообщение, на которое отвечают
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to INT DEFAULT NULL;
-- #19 Несколько медиа в одном сообщении/посте (JSON-массив URL)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media TEXT DEFAULT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media TEXT DEFAULT NULL;

-- Миграция под шифрование почты и добавление медиа
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD UNIQUE INDEX IF NOT EXISTS idx_email_hash (email_hash);
ALTER TABLE users DROP INDEX IF EXISTS email;
UPDATE users SET email = '' WHERE email IS NULL;
ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url VARCHAR(255) DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url VARCHAR(255) DEFAULT NULL;
ALTER TABLE users MODIFY COLUMN last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Таблица закрепа от админа
CREATE TABLE IF NOT EXISTS admin_pin (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Начальная вставка закрепа
INSERT INTO admin_pin (id, content) 
SELECT 1, 'Привет! Это закрепленный пост от админа.' 
WHERE NOT EXISTS (SELECT 1 FROM admin_pin WHERE id = 1);



