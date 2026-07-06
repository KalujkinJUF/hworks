(function() {
    const translations = {
        en: {
            // Navigation
            "nav_home": "Home",
            "nav_search": "Search",
            "nav_friends": "Friends",
            "nav_chat": "Chat",
            "nav_register": "Register",
            "nav_login": "Login",
            "nav_profile": "Profile",
            "nav_admin": "Admin",
            "nav_logout": "Logout",

            // General / Alerts
            "modal_alert_title": "WARNING",
            "modal_confirm_title": "CONFIRMATION",
            "modal_yes": "YES",
            "modal_no": "NO",
            "modal_ok": "OK",
            "loading": "Loading...",
            "error_load": "Load error",
            "error_network": "Network error",
            "error_delete_post": "Failed to delete post",
            "error_delete_comment": "Failed to delete comment",
            "error_avatar_upload": "Failed to upload avatar",
            "error_delete_review": "Failed to delete review",
            "error_network_delete_review": "Network error while deleting review",
            "alert_banned_access": "Your account is banned. Access to friends and chat is restricted.",
            "delete": "Delete",
            "save": "Save",
            "cancel": "Cancel",
            "edit": "Edit",
            "send": "Send",
            "enter_code": "Enter the 6-digit code",
            "enter_email": "Enter email",
            "saved": "Saved!",
            "error_generic": "Error",
            "error_save": "Save error",
            "confirm_review_delete": "Are you sure you want to delete this review?",

            // Index (Main Feed)
            "admin_pin_title": "Admin Pin",
            "admin_pin_placeholder": "Loading...",
            "posts_title": "Posts",
            "feed_global": "Global Feed",
            "feed_subs": "My Subscriptions",
            "feed_updates": "Updates",
            "write_post_placeholder": "Write a post...",
            "attach_photo": "Attach photo",
            "publish_post": "PUBLISH POST",
            "publish_update": "Update",
            "load_more": "Load more",
            "online_now_title": "Online now",
            "nobody_online": "Nobody is online",
            "comments_title": "Comments",
            "write_comment_placeholder": "Write a comment...",
            "like_btn": "Like",
            "liked_btn": "Liked",
            "read_more": "Read more",
            "post_created_success": "Post published successfully",
            "comment_added_success": "Comment added",
            "confirm_post_delete": "Are you sure you want to delete this post?",
            "confirm_comment_delete": "Are you sure you want to delete this comment?",

            // Profile
            "tab_info": "Info",
            "tab_settings": "Settings",
            "profile_joined": "Joined:",
            "profile_role": "Role:",
            "profile_status": "Status:",
            "profile_about_title": "ABOUT ME:",
            "profile_wall_title": "WALL",
            "profile_write_btn": "WRITE",
            "profile_settings_title": "CHANGE USERNAME AND PASSWORD",
            "profile_new_username_placeholder": "Enter new username",
            "profile_new_password_placeholder": "Enter new password",
            "profile_curr_password_placeholder": "Enter current password",
            "profile_save_settings": "SAVE CHANGES",
            "profile_delete_title": "DELETE ACCOUNT",
            "profile_delete_code_placeholder": "Verification code",
            "profile_delete_btn": "DELETE ACCOUNT",
            "profile_confirm_delete_btn": "Confirm Deletion",
            "profile_delete_confirm": "Are you sure you want to permanently delete your account?",
            "profile_delete_success": "Account successfully deleted.",
            "profile_delete_code_sent": "A confirmation code has been sent to your email.",
            "profile_bio_placeholder": "Tell something about yourself...",
            "profile_bio_saved": "Biography updated",
            "profile_subscribed": "Subscribed",
            "profile_subscribe": "Subscribe",
            "profile_status_online": "online",
            "profile_status_offline": "offline",
            "profile_status_away": "away",
            "profile_status_dnd": "do not disturb",
            "profile_username": "Username:",
            "profile_email": "Email:",
            "profile_followers": "Followers:",
            "profile_following": "Following:",
            "profile_change_avatar": "Change avatar",
            "profile_add_avatar": "Add avatar",
            "profile_mutual_friends": "Mutual Friends",
            "profile_wall_loading": "Loading wall comments...",
            "profile_email_verification": "Email Verification",
            "profile_email_verification_hint": "A code has been sent to your email. Enter it below:",
            "profile_verify_btn": "Confirm",
            "profile_new_email_hint": "Did not receive the code or made a typo?",
            "profile_new_email_btn": "Change email",
            "profile_new_email_placeholder": "New email",

            // Friends
            "friends_title": "Friends List",
            "friends_no_requests": "No friend requests",
            "friends_no_friends": "You have no friends yet",
            "friends_incoming": "Incoming Requests",
            "friends_outgoing": "Outgoing Requests",
            "friends_accept": "Accept",
            "friends_decline": "Decline",
            "friends_cancel": "Cancel",
            "friends_remove": "Remove",
            "friends_search_hint": "Find friends through Search",
            "friends_request_sent": "Request sent",

            // Chat
            "chat_no_friends": "You have no friends",
            "chat_no_chat": "Select a friend to start chatting",
            "chat_no_messages": "No messages. Start a conversation!",
            "chat_message_placeholder": "Write a message...",
            "chat_message_empty": "Message cannot be empty",
            "chat_confirm_message_delete": "Are you sure you want to delete this message?",

            // Search
            "search_title": "User Search",
            "search_input_placeholder": "Enter username...",
            "search_no_results": "No users found",

            // About
            "about_title": "About Voidtree",
            "about_description": "Voidtree is a fully decentralized-style, zero-telemetry, anonymous social network built with privacy by design.",
            "about_features_title": "Key Features:",
            "about_feature_1": "Complete anonymity (no IP tracking, no geolocation, no telemetry).",
            "about_feature_2": "Zero-knowledge encryption design: personal messages and posts are symmetrically encrypted with AES-256 in the database.",
            "about_feature_3": "No tracking scripts, cookies are HTTP-only and strict.",
            "about_feature_4": "Secure media processing (EXIF stripping and safe re-encoding).",
            "about_back": "Back to Home",
            "eula_title": "End User License Agreement (EULA)",
            "eula_text": "READ CAREFULLY BEFORE USING THIS SOFTWARE.\n\nThis is a legally binding agreement...\n\nCopyright (c) 2026, hworks.space. All rights reserved.",

            // Sign In / Sign Up
            "login_title": "Sign In",
            "login_user_placeholder": "Username or Email",
            "login_pass_placeholder": "Password",
            "login_btn": "Sign In",
            "login_no_account": "No account yet?",
            "login_register_link": "Register",
            "register_title": "Sign Up",
            "register_user_placeholder": "Username",
            "register_email_placeholder": "Email",
            "register_pass_placeholder": "Password",
            "register_btn": "Sign Up",
            "register_has_account": "Already have an account?",
            "register_login_link": "Sign In",
            "register_error_requirements": "Password does not meet requirements",

            // Admin
            "admin_panel_title": "Administration Panel",
            "admin_system_info": "System Information",
            "admin_users_list": "Users List",
            "admin_ban_user": "Ban",
            "admin_unban_user": "Unban",
            "admin_change_role": "Change Role"
        },
        ru: {
            // Navigation
            "nav_home": "Главная",
            "nav_search": "Поиск",
            "nav_friends": "Друзья",
            "nav_chat": "Чат",
            "nav_register": "Регистрация",
            "nav_login": "Логин",
            "nav_profile": "Профиль",
            "nav_admin": "Админка",
            "nav_logout": "Выйти",

            // General / Alerts
            "modal_alert_title": "ВНИМАНИЕ",
            "modal_confirm_title": "ПОДТВЕРЖДЕНИЕ",
            "modal_yes": "ДА",
            "modal_no": "НЕТ",
            "modal_ok": "OK",
            "loading": "Загрузка...",
            "error_load": "Ошибка загрузки",
            "error_network": "Ошибка сети",
            "error_delete_post": "Ошибка удаления поста",
            "error_delete_comment": "Ошибка удаления комментария",
            "error_avatar_upload": "Ошибка загрузки аватарки",
            "error_delete_review": "Ошибка удаления отзыва",
            "error_network_delete_review": "Ошибка сети при удалении отзыва",
            "alert_banned_access": "Ваш аккаунт заблокирован. Доступ к друзьям и чату ограничен.",
            "delete": "Удалить",
            "save": "Сохранить",
            "cancel": "Отмена",
            "edit": "Редактировать",
            "send": "Отправить",
            "enter_code": "Введите 6-значный код",
            "enter_email": "Введите email",
            "saved": "Сохранено!",
            "error_generic": "Ошибка",
            "error_save": "Ошибка сохранения",
            "confirm_review_delete": "Вы уверены, что хотите удалить этот отзыв?",

            // Index (Main Feed)
            "admin_pin_title": "Закреп от админа",
            "admin_pin_placeholder": "Загрузка...",
            "posts_title": "Посты",
            "feed_global": "Глобальная лента",
            "feed_subs": "Мои подписки",
            "feed_updates": "Обновления",
            "write_post_placeholder": "Напишите пост...",
            "attach_photo": "Прикрепить фото",
            "publish_post": "ОПУБЛИКОВАТЬ ПОСТ",
            "publish_update": "Обновление",
            "load_more": "Загрузить ещё",
            "online_now_title": "Сейчас онлайн",
            "nobody_online": "Никого нет в сети",
            "comments_title": "Комментарии",
            "write_comment_placeholder": "Напишите комментарий...",
            "like_btn": "Мне нравится",
            "liked_btn": "Понравилось",
            "read_more": "Читать далее",
            "post_created_success": "Пост успешно опубликован",
            "comment_added_success": "Комментарий добавлен",
            "confirm_post_delete": "Вы уверены, что хотите удалить этот пост?",
            "confirm_comment_delete": "Вы уверены, что хотите удалить этот комментарий?",

            // Profile
            "tab_info": "Информация",
            "tab_settings": "Настройки",
            "profile_joined": "Регистрация:",
            "profile_role": "Роль:",
            "profile_status": "Статус:",
            "profile_about_title": "ОБО МНЕ:",
            "profile_wall_title": "СТЕНА",
            "profile_write_btn": "НАПИСАТЬ",
            "profile_settings_title": "СМЕНИТЬ ЛОГИН И ПАРОЛЬ",
            "profile_new_username_placeholder": "Введите новый логин",
            "profile_new_password_placeholder": "Введите новый пароль",
            "profile_curr_password_placeholder": "Введите текущий пароль",
            "profile_save_settings": "СОХРАНИТЬ ИЗМЕНЕНИЯ",
            "profile_delete_title": "УДАЛЕНИЕ АККАУНТА",
            "profile_delete_code_placeholder": "Код подтверждения",
            "profile_delete_btn": "УДАЛИТЬ АККАУНТ",
            "profile_confirm_delete_btn": "Подтвердить удаление",
            "profile_delete_confirm": "Вы уверены, что хотите безвозвратно удалить свой аккаунт?",
            "profile_delete_success": "Аккаунт успешно удален.",
            "profile_delete_code_sent": "Код подтверждения отправлен на вашу почту.",
            "profile_bio_placeholder": "Расскажите что-нибудь о себе...",
            "profile_bio_saved": "Биография обновлена",
            "profile_subscribed": "Вы подписаны",
            "profile_subscribe": "Подписаться",
            "profile_status_online": "в сети",
            "profile_status_offline": "не в сети",
            "profile_status_away": "отошел",
            "profile_status_dnd": "не беспокоить",
            "profile_username": "Имя:",
            "profile_email": "Email:",
            "profile_followers": "Подписчики:",
            "profile_following": "Подписки:",
            "profile_change_avatar": "Сменить аватар",
            "profile_add_avatar": "Добавить аватар",
            "profile_mutual_friends": "Общие друзья",
            "profile_wall_loading": "Загрузка отзывов...",
            "profile_email_verification": "Подтверждение почты",
            "profile_email_verification_hint": "На вашу почту отправлен код. Введите его ниже:",
            "profile_verify_btn": "Подтвердить",
            "profile_new_email_hint": "Не пришел код или опечатались в адресе?",
            "profile_new_email_btn": "Сменить email",
            "profile_new_email_placeholder": "Новый email",

            // Friends
            "friends_title": "Список друзей",
            "friends_no_requests": "Нет запросов в друзья",
            "friends_no_friends": "У вас пока нет друзей",
            "friends_incoming": "Входящие запросы",
            "friends_outgoing": "Исходящие запросы",
            "friends_accept": "Принять",
            "friends_decline": "Отклонить",
            "friends_cancel": "Отменить",
            "friends_remove": "Удалить",
            "friends_search_hint": "Найдите друзей через Поиск",
            "friends_request_sent": "Запрос отправлен",

            // Chat
            "chat_no_friends": "У вас нет друзей",
            "chat_no_chat": "Выберите друга для начала общения",
            "chat_no_messages": "Нет сообщений. Начните диалог!",
            "chat_message_placeholder": "Напишите сообщение...",
            "chat_message_empty": "Сообщение не может быть пустым",
            "chat_confirm_message_delete": "Вы уверены, что хотите удалить это сообщение?",

            // Search
            "search_title": "Поиск пользователей",
            "search_input_placeholder": "Введите имя...",
            "search_no_results": "Пользователи не найдены",

            // About
            "about_title": "О Voidtree",
            "about_description": "Voidtree — это полностью децентрализованная, анонимная социальная сеть с нулевой телеметрией, созданная с приоритетом конфиденциальности.",
            "about_features_title": "Ключевые особенности:",
            "about_feature_1": "Полная анонимность (без отслеживания IP, геолокации и сбора телеметрии).",
            "about_feature_2": "Концепция Zero-Knowledge: личные сообщения и посты шифруются в базе данных по стандарту AES-256.",
            "about_feature_3": "Никаких скриптов слежки, строгие httpOnly cookie.",
            "about_feature_4": "Безопасная обработка медиафайлов (очистка EXIF и перекодирование).",
            "about_back": "Вернуться на главную",
            "eula_title": "Лицензионное соглашение (EULA)",
            "eula_text": "ВНИМАТЕЛЬНО ОЗНАКОМЬТЕСЬ С НАСТОЯЩИМ СОГЛАШЕНИЕМ ПЕРЕД УСТАНОВКОЙ ИЛИ ИСПОЛЬЗОВАНИЕМ ПРОГРАММНОГО ОБЕСПЕЧЕНИЯ.\n\nНастоящее Лицензионное соглашение с конечным пользователем (далее — «Соглашение») является юридически обязательным договором, заключенным между Вами (физическим или юридическим лицом, далее — «Пользователь») и Автором проекта (далее — «Лицензиар»), в отношении программного обеспечения, включая все связанные с ним компоненты, файлы, документацию и обновления (далее совместно — «Программа»).\n\nУстановка, запуск, копирование или иное использование Программы означает полное, безусловное и безоговорочное согласие Пользователя со всеми условиями настоящего Соглашения. Если Вы не согласны с условиями Соглашения, Вы не имеете права устанавливать или использовать Программу и обязаны немедленно удалить все ее копии со своих устройств.\n\n1. ПРЕДОСТАВЛЕНИЕ ЛИЦЕНЗИИ\n1.1. Ограниченная лицензия. Лицензиар предоставляет Пользователю неисключительную, личную, непередаваемую, отзывную лицензию на установку и использование Программы на устройствах, находящихся в законном владении Пользователя, исключительно в целях и способами, предусмотренными технической документацией и настоящим Соглашением.\n1.2. Срок действия. Лицензия предоставляется на весь срок действия авторских прав на Программу, если иное не ограничено условиями приобретения конкретной версии или типом подписки.\n1.3. Сохранение прав. Программа лицензируется, а не продается. Все права собственности, авторские права и иные права интеллектуальной собственности на Программу остаются за Лицензиаром.\n\n2. ОГРАНИЧЕНИЯ ИСПОЛЬЗОВАНИЯ\n2.1. Пользователь обязуется не совершать лично и не разрешать третьим лицам совершать следующие действия:\n- Вскрывать технологию, декомпилировать, разбирать, деассемблировать, модифицировать, адаптировать, переводить или иным образом пытаться извлечь исходный код Программы или любой ее части.\n- Создавать производные продукты на основе Программы.\n- Удалять, изменять, скрывать или делать невидимыми любые уведомления об авторских правах, товарных знаках, торговых марках или иных правах собственности Лицензиара.\n- Использовать Программу для распространения вредоносного ПО, совершения кибератак, нарушения применимого законодательства или ущемления прав третьих лиц.\n- Сдавать Программу в аренду, прокат, сублицензировать или использовать ее для предоставления коммерческих услуг третьим лицам без предварительного письменного согласия Лицензиара.\n\n3. ПОЛНЫЙ ОТКАЗ ОТ ГАРАНТИЙ\n3.1. Предоставление «Как есть». Программа предоставляется Пользователю на условиях «КАК ЕСТЬ» (AS IS) и «ПО МЕРЕ ДОСТУПНОСТИ» (AS AVAILABLE). Лицензиар не предоставляет никаких гарантий, явных или подразумеваемых, законодательных или иных.\n3.2. Исключение подразумеваемых гарантий. Лицензиар прямо отказывается от любых подразумеваемых гарантий, включая, помимо прочего: гарантии товарного состояния (коммерческой ценности), пригодности для конкретной или определенной цели, бесперебойной и безошибочной работы Программы, совместимости с любым другим программным обеспечением или аппаратными средствами, а также гарантии отсутствия нарушений прав третьих лиц.\n3.3. Ответственность за выбор. Пользователь единолично несет полную ответственность за выбор Программы для достижения необходимых ему результатов, а также за установку, использование и результаты, полученные с помощью Программы. Все риски, связанные с качеством и производительностью Программы, лежат исключительно на Пользователе.\n\n4. ОГРАНИЧЕНИЕ ОТВЕТСТВЕННОСТИ И ОСВОБОЖДЕНИЕ ОТ УБЫТКОВ\n4.1. Исключение ответственности. Ни при каких обстоятельствах Лицензиар, его партнеры, сотрудники, агенты или поставщики не несут ответственности перед Пользователем или любыми третьими лицами за любые прямые, косвенные, случайные, специальные, штрафные или последующие убытки, возникшие в результате использования или невозможности использования Программы.\n4.2. Виды исключенных убытков. Настоящее ограничение распространяется, помимо прочего, на:\n- Упущенную выгоду, потерю ожидаемой прибыли, коммерческого дохода или сбережений;\n- Потерю, повреждение, искажение или уничтожение данных, баз данных или иной информации;\n- Прекращение или приостановку деловой активности, простои производства;\n- Сбои в работе компьютерного, serverного или сетевого оборудования;\n- Любые иные материальные или нематериальные потери, возникшие на основании договора, деликта (включая небрежность), нарушения гарантий или иных правовых оснований, даже если Лицензиар был заранее предупрежден о возможности наступления таких убытков или мог их предвидеть.\n\n5. ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ И ЗАЩИТА ДАННЫХ\n5.1. Приоритет приватности. Лицензиар уважает право Пользователя на конфиденциальность. Программа спроектирована таким образом, чтобы минимизировать обработку любых данных.\n5.2. Отсутствие сбора персональных данных. Программа не собирает, не передает, не хранит и не обрабатывает персональные данные Пользователя (включая, но не ограничиваясь: имена, адреса электронной почты, пароли, платежную информацию, IP-адреса, геолокацию или файлы на устройстве).\n5.3. Локальная обработка. Все данные, вводимые Пользователем, генерируемые Программой или обрабатываемые в ходе ее работы, хранятся и обрабатываются исключительно на локальном устройстве Пользователя. Программа не отправляет эти данные на внешние серверы Лицензиара или третьих лиц.\n5.4. Анонимная техническая диагностика. Программа может отправлять Лицензиару автоматические отчеты об ошибках (crash reports) исключительно в целях улучшения стабильности ПО. Данные отчеты являются полностью обезличенными (анонимными) и содержат только технические параметры (например, версия Программы, тип операционной системы, стек вызовов ошибки). Эти данные не могут быть использованы для идентификации личности Пользователя и никогда не передаются третьим сторонам.\n\n6. ПРЕКРАЩЕНИЕ ДЕЙСТВИЯ СОГЛАШЕНИЯ\n6.1. Настоящее Соглашение действует до момента его расторжения.\n6.2. Пользователь может расторгнуть Соглашение в любой момент, прекратив использование Программы и полностью удалив Программу и все ее копии со всех своих устройств.\n6.3. Соглашение прекращает свое действие автоматически и незамедлительно, без какого-либо уведомления со стороны Лицензиара, в случае нарушения Пользователем любого из условий настоящего Соглашения (включая ограничения раздела 2). При прекращении действия Соглашения Пользователь обязан немедленно прекратить использование Программы и уничтожить все ее копии.\n\n7. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ\n7.1. Автономность положений. Если какое-либо положение настоящего Соглашения будет признано судом компетентной юрисдикции недействительным, незаконным или не имеющим юридической силы, это не повлияет на действительность и применимость остальных положений Соглашения, которые сохранят полную силу.\n7.2. Полнота Соглашения. Настоящее Соглашение представляет собой полное соглашение между Пользователем и Лицензиаром в отношении Программы и заменяет собой любые предшествующие устные или письменные договоренности, соглашения или заявления.\n7.3. Изменения. Лицензиар оставляет за собой право изменять условия настоящего Соглашения при выпуске обновлений Программы. Продолжение использования Программы после внесения изменений означает согласие Пользователя с новой редакцией Соглашения.\n\nCopyright (c) 2026, hworks.space. Все права защищены.",

            // Sign In / Sign Up
            "login_title": "Вход в систему",
            "login_user_placeholder": "Логин или Email",
            "login_pass_placeholder": "Пароль",
            "login_btn": "Войти",
            "login_no_account": "Еще нет аккаунта?",
            "login_register_link": "Зарегистрироваться",
            "register_title": "Регистрация",
            "register_user_placeholder": "Логин",
            "register_email_placeholder": "Email",
            "register_pass_placeholder": "Пароль",
            "register_btn": "Зарегистрироваться",
            "register_has_account": "Уже есть аккаунт?",
            "register_login_link": "Войти",
            "register_error_requirements": "Пароль не соответствует требованиям безопасности",

            // Admin
            "admin_panel_title": "Панель администратора",
            "admin_system_info": "Системная информация",
            "admin_users_list": "Список пользователей",
            "admin_ban_user": "Бан",
            "admin_unban_user": "Разбанить",
            "admin_change_role": "Сменить роль"
        },
        uk: {
            // Navigation
            "nav_home": "Головна",
            "nav_search": "Пошук",
            "nav_friends": "Друзі",
            "nav_chat": "Чат",
            "nav_register": "Реєстрація",
            "nav_login": "Логін",
            "nav_profile": "Профіль",
            "nav_admin": "Адмінка",
            "nav_logout": "Вийти",

            // General / Alerts
            "modal_alert_title": "УВАГА",
            "modal_confirm_title": "ПІДТВЕРДЖЕННЯ",
            "modal_yes": "ТАК",
            "modal_no": "НІ",
            "modal_ok": "OK",
            "loading": "Завантаження...",
            "error_load": "Помилка завантаження",
            "error_network": "Помилка мережі",
            "error_delete_post": "Помилка видалення поста",
            "error_delete_comment": "Помилка видалення коментаря",
            "error_avatar_upload": "Помилка завантаження аватарки",
            "error_delete_review": "Помилка видалення відгуку",
            "error_network_delete_review": "Помилка мережі при видаленні відгуку",
            "alert_banned_access": "Ваш акаунт заблоковано. Доступ до друзів та чату обмежений.",
            "delete": "Видалити",
            "save": "Зберегти",
            "cancel": "Скасувати",
            "edit": "Редагувати",
            "send": "Надіслати",
            "enter_code": "Введіть 6-значний код",
            "enter_email": "Введіть email",
            "saved": "Збережено!",
            "error_generic": "Помилка",
            "error_save": "Помилка збереження",
            "confirm_review_delete": "Ви впевнені, що хочете видалити цей відгук?",

            // Index (Main Feed)
            "admin_pin_title": "Закріп від адміна",
            "admin_pin_placeholder": "Завантаження...",
            "posts_title": "Пости",
            "feed_global": "Глобальна стрічка",
            "feed_subs": "Мої підписки",
            "feed_updates": "Оновлення",
            "write_post_placeholder": "Напишіть пост...",
            "attach_photo": "Додати фото",
            "publish_post": "ОПУБЛІКУВАТИ ПОСТ",
            "publish_update": "Оновлення",
            "load_more": "Завантажити ще",
            "online_now_title": "Зараз онлайн",
            "nobody_online": "Нікого немає в мережі",
            "comments_title": "Коментарі",
            "write_comment_placeholder": "Напишіть коментар...",
            "like_btn": "Мені подобається",
            "liked_btn": "Сподобалось",
            "read_more": "Читати далі",
            "post_created_success": "Пост успішно опубліковано",
            "comment_added_success": "Коментар додано",
            "confirm_post_delete": "Ви впевнені, що хочете видалити цей пост?",
            "confirm_comment_delete": "Ви впевнені, що хочете видалити цей коментар?",

            // Profile
            "tab_info": "Інформація",
            "tab_settings": "Налаштування",
            "profile_joined": "Реєстрація:",
            "profile_role": "Роль:",
            "profile_status": "Статус:",
            "profile_about_title": "ПРО МЕНЕ:",
            "profile_wall_title": "СТІНА",
            "profile_write_btn": "НАПИСАТИ",
            "profile_settings_title": "ЗМІНИТИ ЛОГІН І ПАРОЛЬ",
            "profile_new_username_placeholder": "Введіть новий логін",
            "profile_new_password_placeholder": "Введіть новий пароль",
            "profile_curr_password_placeholder": "Введіть поточний пароль",
            "profile_save_settings": "ЗБЕРЕГТИ ЗМІНИ",
            "profile_delete_title": "ВИДАЛЕННЯ АКАУНТА",
            "profile_delete_code_placeholder": "Код підтвердження",
            "profile_delete_btn": "ВИДАЛИТИ АКАУНТ",
            "profile_confirm_delete_btn": "Підтвердити видалення",
            "profile_delete_confirm": "Ви впевнені, що хочете назавжди видалити свій акаунт?",
            "profile_delete_success": "Акаунт успішно видалено.",
            "profile_delete_code_sent": "Код підтвердження надіслано на вашу пошту.",
            "profile_bio_placeholder": "Розкажіть що-небудь про себе...",
            "profile_bio_saved": "Біографію оновлено",
            "profile_subscribed": "Ви підписані",
            "profile_subscribe": "Підписатися",
            "profile_status_online": "в мережі",
            "profile_status_offline": "не в мережі",
            "profile_status_away": "пішов",
            "profile_status_dnd": "не турбувати",
            "profile_username": "Им'я:",
            "profile_email": "Email:",
            "profile_followers": "Підписники:",
            "profile_following": "Підписки:",
            "profile_change_avatar": "Змінити аватар",
            "profile_add_avatar": "Добавить аватар",
            "profile_mutual_friends": "Спільні друзі",
            "profile_wall_loading": "Завантаження відгуків...",
            "profile_email_verification": "Підтвердження пошти",
            "profile_email_verification_hint": "На вашу пошту надіслано код. Введіть його нижче:",
            "profile_verify_btn": "Підтвердити",
            "profile_new_email_hint": "Не надійшов код або помилилися в адресі?",
            "profile_new_email_btn": "Змінити email",
            "profile_new_email_placeholder": "Новий email",

            // Friends
            "friends_title": "Список друзів",
            "friends_no_requests": "Немає запитів у друзі",
            "friends_no_friends": "У вас поки немає друзів",
            "friends_incoming": "Вхідні запити",
            "friends_outgoing": "Вихідні запити",
            "friends_accept": "Прийняти",
            "friends_decline": "Відхилити",
            "friends_cancel": "Скасувати",
            "friends_remove": "Вилучити",
            "friends_search_hint": "Знайдіть друзів через Пошук",
            "friends_request_sent": "Запит надіслано",

            // Chat
            "chat_no_friends": "У вас немає друзів",
            "chat_no_chat": "Оберіть друга для початку спілкування",
            "chat_no_messages": "Немає повідомлень. Почніть діалог!",
            "chat_message_placeholder": "Напишіть повідомлення...",
            "chat_message_empty": "Повідомлення не може бути порожнім",
            "chat_confirm_message_delete": "Ви впевнені, що хочете видалити це повідомлення?",

            // Search
            "search_title": "Пошук користувачів",
            "search_input_placeholder": "Введіть ім'я...",
            "search_no_results": "Користувачів не знайдено",

            // About
            "about_title": "Про Voidtree",
            "about_description": "Voidtree — це повністю децентралізована, анонімна соціальна мережа з нульовою телеметрією, створена з пріоритетом конфіденційності.",
            "about_features_title": "Ключові особливості:",
            "about_feature_1": "Повна анонімність (без відстеження IP, геолокації та збору телеметрії).",
            "about_feature_2": "Концепція Zero-Knowledge: особисті повідомлення та пости шифруються в базі даних за стандартом AES-256.",
            "about_feature_3": "Ніяких скриптів стеження, суворі httpOnly cookie.",
            "about_feature_4": "Безпечна обробка медіафайлів (очищення EXIF та перекодування).",
            "about_back": "На головну",

            // Sign In / Sign Up
            "login_title": "Вхід у систему",
            "login_user_placeholder": "Логін або Email",
            "login_pass_placeholder": "Пароль",
            "login_btn": "Увійти",
            "login_no_account": "Ще немає акаунта?",
            "login_register_link": "Зареєструватися",
            "register_title": "Реєстрація",
            "register_user_placeholder": "Логін",
            "register_email_placeholder": "Email",
            "register_pass_placeholder": "Пароль",
            "register_btn": "Зареєструватися",
            "register_has_account": "Вже є акаунт?",
            "register_login_link": "Увійти",
            "register_error_requirements": "Пароль не відповідає вимогам безпеки",

            // Admin
            "admin_panel_title": "Панель адміністратора",
            "admin_system_info": "Системна інформація",
            "admin_users_list": "Список користувачів",
            "admin_ban_user": "Бан",
            "admin_unban_user": "Розбанити",
            "admin_change_role": "Змінити роль"
        }
    };

    let currentLang = localStorage.getItem('lang') || 'en';

    window.getCurrentLanguage = function() {
        return currentLang;
    };

    window.t = function(key, fallback = '') {
        const langData = translations[currentLang];
        if (langData && langData[key] !== undefined) {
            return langData[key];
        }
        // Если перевода нет, пробуем английский язык
        const enData = translations['en'];
        if (enData && enData[key] !== undefined) {
            return enData[key];
        }
        return fallback || key;
    };

    window.changeLanguage = function(lang) {
        if (translations[lang]) {
            localStorage.setItem('lang', lang);
            currentLang = lang;
            window.location.reload();
        }
    };

    window.applyTranslations = function() {
        // Текстовое содержимое
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = window.t(key);
            if (translation) {
                if (translation.includes('<') && translation.includes('>')) {
                    el.innerHTML = translation;
                } else {
                    el.textContent = translation;
                }
            }
        });

        // Плейсхолдеры
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = window.t(key);
            if (translation) {
                el.setAttribute('placeholder', translation);
            }
        });

        // Значения кнопок input
        document.querySelectorAll('[data-i18n-value]').forEach(el => {
            const key = el.getAttribute('data-i18n-value');
            const translation = window.t(key);
            if (translation) {
                el.setAttribute('value', translation);
            }
        });
    };

    // Привязка обработчиков к статическим кнопкам языка (например, в профиле)
    function bindLanguageButtons() {
        const langBtns = document.querySelectorAll('.lang-btn');
        langBtns.forEach(btn => {
            const lang = btn.getAttribute('data-lang');
            if (!lang) return;
            
            if (lang === currentLang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            
            // Удаляем старые лисенеры (чтобы не дублировать)
            const newBtn = btn.cloneNode(true);
            if (btn.parentNode) {
                btn.parentNode.replaceChild(newBtn, btn);
            }
            
            newBtn.addEventListener("click", (e) => {
                e.preventDefault();
                window.changeLanguage(lang);
            });
        });
    }

    // Функция применения темы
    function applyTheme() {
        const theme = localStorage.getItem('app_theme') || 'default';
        let themeLink = document.getElementById('theme-stylesheet');
        
        if (!themeLink) {
            themeLink = document.createElement('link');
            themeLink.id = 'theme-stylesheet';
            themeLink.rel = 'stylesheet';
            if (document.head) {
                document.head.appendChild(themeLink);
            }
        }
        
        if (theme === 'aero') {
            document.documentElement.classList.add('theme-aero');
            if (document.body) document.body.classList.add('theme-aero');
            if (!themeLink.href.endsWith('aero.css')) {
                themeLink.href = 'aero.css';
            }
        } else {
            document.documentElement.classList.remove('theme-aero');
            if (document.body) document.body.classList.remove('theme-aero');
            themeLink.href = '';
        }
    }

    // Применяем тему сразу для предотвращения FOUC
    applyTheme();

    document.addEventListener("DOMContentLoaded", () => {
        applyTheme();
        window.applyTranslations();
        bindLanguageButtons();
    });

    window.addEventListener("load", () => {
        applyTheme();
        window.applyTranslations();
        bindLanguageButtons();
    });
})();
