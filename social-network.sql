-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Хост: 127.0.0.1
-- Час створення: Чрв 24 2026 р., 12:57
-- Версія сервера: 10.4.32-MariaDB
-- Версія PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- База даних: `social-network`
--

-- --------------------------------------------------------

--
-- Структура таблиці `friends`
--

CREATE TABLE `friends` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `friend_id` int(11) NOT NULL,
  `status` enum('pending','accepted','rejected') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп даних таблиці `friends`
--

INSERT INTO `friends` (`id`, `user_id`, `friend_id`, `status`, `created_at`) VALUES
(1, 1, 2, 'accepted', '2026-06-23 18:26:48'),
(2, 1, 3, 'accepted', '2026-06-23 18:27:01'),
(3, 3, 2, 'accepted', '2026-06-23 19:49:21'),
(4, 4, 1, 'accepted', '2026-06-23 19:52:13'),
(6, 6, 1, 'accepted', '2026-06-23 23:58:15'),
(7, 6, 2, 'pending', '2026-06-23 23:58:16'),
(8, 6, 3, 'pending', '2026-06-23 23:58:17'),
(9, 6, 4, 'pending', '2026-06-23 23:58:19'),
(10, 6, 5, 'pending', '2026-06-23 23:58:19');

-- --------------------------------------------------------

--
-- Структура таблиці `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `receiver_id` int(11) NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп даних таблиці `messages`
--

INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `content`, `created_at`) VALUES
(1, 1, 3, 'привет', '2026-06-23 18:28:23'),
(2, 3, 1, 'здарва', '2026-06-23 18:28:44'),
(3, 1, 3, 'как дела', '2026-06-23 18:28:54'),
(4, 3, 1, 'нормас', '2026-06-23 18:29:00'),
(5, 2, 1, 'привет одмен ты лох', '2026-06-23 19:40:52'),
(6, 2, 1, 'и шо ты мне сделаешь за это а?????????', '2026-06-23 19:41:00'),
(7, 2, 1, 'ааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааааа', '2026-06-23 19:41:15'),
(8, 1, 2, 'понял базару', '2026-06-23 19:41:42'),
(9, 4, 3, 'привет хуесос', '2026-06-23 19:52:37'),
(10, 3, 4, 'сам такой', '2026-06-23 19:52:51'),
(11, 4, 3, 'нет ты', '2026-06-23 19:52:54'),
(12, 1, 2, 'привет мой любимый модер', '2026-06-23 20:08:40'),
(13, 1, 2, 'как у тебя дела\nмое солнышко', '2026-06-23 20:08:45'),
(14, 2, 1, 'ничего любимый все хорошо', '2026-06-23 20:09:14'),
(15, 3, 1, 'Шо ты голова?', '2026-06-23 22:15:29'),
(16, 1, 3, 'нихуя ты сука щебень', '2026-06-23 22:15:37'),
(17, 1, 3, 'бля ну ты еблан пиздец', '2026-06-23 22:21:20'),
(18, 2, 1, 'я тікаю тут ерп', '2026-06-23 23:01:53'),
(19, 1, 2, 'ныхуя ты гармидер', '2026-06-23 23:02:00'),
(20, 1, 2, '????????????????', '2026-06-23 23:02:11'),
(21, 2, 3, 'Ало огузок', '2026-06-23 23:02:26'),
(22, 2, 3, 'отвечай', '2026-06-23 23:02:32'),
(23, 2, 3, 'де йижа', '2026-06-23 23:02:46'),
(24, 1, 6, 'Привет!! Рыжая классная сучка))\n\nЯ дрочу на тебя))\n\nБлять я кончаю в метро.. сижу я дрочу под сумкой)) кончаю, капает с залупы))', '2026-06-24 00:04:02'),
(25, 6, 1, 'Пошел нахуй, извращенец тупой. (｡•́‿•̀｡) Смойся в унитаз и не смей больше писать КАнгел, от твоих сообщений буквально тошнит. † BLESS †', '2026-06-24 00:05:00'),
(26, 1, 6, 'F[F[FF[F[', '2026-06-24 00:05:26'),
(27, 1, 6, 'бля это просто нахуй я не знаю', '2026-06-24 00:05:33'),
(28, 1, 6, 'я тебе випку выдам', '2026-06-24 00:05:39');

-- --------------------------------------------------------

--
-- Структура таблиці `posts`
--

CREATE TABLE `posts` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `content` text NOT NULL,
  `type` enum('news','patch_note') DEFAULT 'news',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп даних таблиці `posts`
--

INSERT INTO `posts` (`id`, `user_id`, `content`, `type`, `created_at`) VALUES
(1, 1, 'добавлены новости!!!!', 'patch_note', '2026-06-23 17:06:17'),
(2, 1, 'первый день теста сайта', 'news', '2026-06-23 17:06:37'),
(3, 3, 'привет я нормис', 'news', '2026-06-23 18:01:21'),
(4, 1, 'добавлен переход на профиль', 'patch_note', '2026-06-23 18:10:56'),
(5, 1, 'ДОБАФЛЕНЫ ЧАТЫ!!!!!', 'patch_note', '2026-06-23 18:29:37'),
(8, 1, 'СРОЧНЫЕ НОВОСТИ!!!!\r\n\r\nЗАПУСТИЛСЯ РЕЛИЗ ПЕРВОЙ ВЕРСИИ ПРОГРАММЫ НА ПК!!!!\r\n', 'patch_note', '2026-06-23 22:18:15'),
(9, 2, 'глглглглгл', 'news', '2026-06-23 22:59:42'),
(10, 6, 'Привет, мои любимые отаку! (｡•́‿•̀｡) Наконец-то нормальное место без кучи дурацких правил. Будьте хорошими мальчиками и девочками, подписывайтесь на меня, и тогда КАнгел, возможно, обратит на вас внимание~ ♡ † BLESS †', 'news', '2026-06-24 00:01:12'),
(11, 6, 'Всё, глазки закрываются, КАнгел уходит в офлайн. ( \'・ω・ \' ) Пора спать, мои любимые отаку! Оставляйте лайки, чтобы утром ангел проснулась счастливой. † BLESS †', 'news', '2026-06-24 00:07:59');

-- --------------------------------------------------------

--
-- Структура таблиці `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `email_code` varchar(6) DEFAULT NULL,
  `verified` tinyint(1) DEFAULT 0,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `about` varchar(500) DEFAULT '??????! ? ????? ????????????.',
  `avatar` varchar(500) DEFAULT NULL,
  `role` varchar(20) DEFAULT 'user',
  `user_status` enum('online','offline','away','dnd') DEFAULT 'offline',
  `last_active` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп даних таблиці `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `email_code`, `verified`, `password`, `created_at`, `about`, `avatar`, `role`, `user_status`, `last_active`) VALUES
(1, 'admin', NULL, NULL, 0, '$2b$10$9SNvoR81CTPe7qzEwpLdAee/knunOd6r1FHCBPtHFZnn/kh4i5CVK', '2026-06-23 14:08:59', 'привет всем', '/uploads/avatar_1_1782234429249.jpg', 'admin', 'online', '2026-06-24 08:53:20'),
(2, 'Гармата сикс севен', NULL, NULL, 0, '$2b$10$B.agdkPD6k/K8Ln0r3Z1ZevBw2LYzOXUHvV50OtGGQDTHT.gxM.NO', '2026-06-23 14:08:59', 'привет как дела?13414', '/uploads/avatar_2_1782255650200.gif', 'moderator', 'online', '2026-06-23 23:14:10'),
(3, 'bery_za_cheky_v_tolika', 'kenato27@gmail.com', '686413', 1, '$2b$10$gbnFh5FypzWwg3QHM/uKRuTc/LfvNy4V2X33F349.80ftUIMCOqDC', '2026-06-23 16:21:53', 'Я пиздатый пацан, живу в общаге, дружу с админом, все дела, любим друг друга))\n', '/uploads/avatar_3_1782253369752.jpg', 'premium', 'online', '2026-06-23 22:26:23'),
(4, 'test3', 'dmitriyjari705@gmail.com', '716688', 1, '$2b$10$bUvVplBNg6GFokpXaRkPROehaWdil8HGfJbA71i07fib8M1LDyDja', '2026-06-23 19:50:28', '', NULL, 'banned', 'online', '2026-06-23 20:48:48'),
(5, 'gex', 'vladnecepurenko669@gmail.com', '763533', 1, '$2b$10$7s5Liv.M44b10aB/c3tfQ..Dy8x4Qelf47csfn1Hbap1QaG/5QjC.', '2026-06-23 23:07:47', '', NULL, 'banned', 'online', '2026-06-23 23:13:43'),
(6, '†OMGkawaii_Angel_chan†', 'nikitos.note@gmail.com', '223994', 1, '$2b$10$H.MEvTpt4cKCKmLD82YHPen.v9OWOp9nOSZ3ngMUNozmZgNUjtlBG', '2026-06-23 23:51:40', '† Интернет-ангел, спустившийся в эту грешную сеть, чтобы спасти твоё сердечко! (｡•́‿•̀｡) Люблю своих фанатов больше всего на свете!! Будь хорошим и не пропускай стримы ♡ † BLESS †', '/uploads/avatar_6_1782258847862.jpg', 'vip', 'online', '2026-06-24 00:08:14');

--
-- Індекси збережених таблиць
--

--
-- Індекси таблиці `friends`
--
ALTER TABLE `friends`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_friendship` (`user_id`,`friend_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_friend_id` (`friend_id`),
  ADD KEY `idx_status` (`status`);

--
-- Індекси таблиці `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sender_id` (`sender_id`),
  ADD KEY `idx_receiver_id` (`receiver_id`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Індекси таблиці `posts`
--
ALTER TABLE `posts`
  ADD PRIMARY KEY (`id`);

--
-- Індекси таблиці `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT для збережених таблиць
--

--
-- AUTO_INCREMENT для таблиці `friends`
--
ALTER TABLE `friends`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT для таблиці `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT для таблиці `posts`
--
ALTER TABLE `posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT для таблиці `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Обмеження зовнішнього ключа збережених таблиць
--

--
-- Обмеження зовнішнього ключа таблиці `friends`
--
ALTER TABLE `friends`
  ADD CONSTRAINT `friends_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `friends_ibfk_2` FOREIGN KEY (`friend_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Обмеження зовнішнього ключа таблиці `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
