(function() {
    const translations = {
        en: {
            // Navigation
            "nav_home": "Home",
            "about_source": "Source code",
            "version_label": "Version",
            "attach_video": "Video",
            "attach_audio": "Audio",
            "attach_file": "Attach file",
            "ctx_reply": "Reply",
            "ctx_save": "Save",
            "ctx_copy_link": "Copy link",
            "ctx_copy": "Copy",
            "you": "You",
            "friends_add": "Add friend",
            "friends_delete": "Remove friend",
            "friends_delete_confirm": "Are you sure you want to remove this user from your friends?",
            "friends_reject": "Decline",
            "friends_pending": "Pending",
            "friends_none": "You have no friends yet",
            "friends_no_outgoing": "You have no outgoing requests",
            "admin_username_label": "Username:",
            "admin_role_label": "Role:",
            "admin_email_label": "Email:",
            "admin_password_label": "Password:",
            "admin_reg_date_label": "Reg. date:",
            "admin_new_username_placeholder": "New username",
            "admin_new_email_placeholder": "New email",
            "admin_hide_users_list": "Hide all users",
            "admin_delete_user_confirm": "Are you sure you want to delete this user?",
            "profile_appearance_title": "Appearance",
            "profile_theme_label": "Theme:",
            "profile_lang_label": "Language:",
            "profile_saved_success": "Changes saved",
            "theme_aero": "Aero",
            "theme_default": "DOS",
            "chat_delete_confirm": "Are you sure you want to delete this message?",
            "confirm_are_you_sure": "Are you sure?",
            "error_forbidden": "Access denied!",
            "error_user_not_found": "User not found",
            "error_username_chars": "Username may contain only letters, digits, underscore, dot and hyphen",
            "error_username_length": "Username must be 3 to 20 characters",
            "login_required": "Please log in.",
            "login_required_profile": "Viewing profiles is available to logged-in users only.",
            "not_specified": "Not specified",
            "register_captcha_required": "Please confirm that you are not a robot.",
            "register_success": "Success! Signing you in...",
            "nav_search": "Search",
            "nav_friends": "Friends",
            "nav_chat": "DM",
            "nav_groups": "Groups",
            "create": "Create",
            "groups_title": "My Groups",
            "groups_create": "Create Group",
            "groups_name_placeholder": "Group name",
            "groups_empty": "You have no groups yet. Create one!",
            "groups_back": "← To groups",
            "groups_channel_placeholder": "Channel name",
            "groups_add_channel": "+ Channel",
            "groups_select_channel": "Select a channel",
            "group_members": "Members",
            "group_admin_badge": "ADMIN",
            "group_add_member": "Invite friend",
            "group_no_friends_to_add": "No friends to invite",
            "group_rename": "Rename group",
            "group_rename_prompt": "New group name:",
            "group_delete": "Delete group",
            "group_delete_confirm": "Delete the group forever? This cannot be undone.",
            "group_leave": "Leave group",
            "group_leave_confirm": "Leave the group?",
            "group_kick": "Remove",
            "group_kick_confirm": "Remove this member?",
            "group_channel_delete_confirm": "Delete this channel?",
            "group_no_access": "No access to this group",
            "group_accept": "Accept",
            "group_reject": "Decline",
            "group_invite_label": "Group invitation",
            "group_invite_accepted": "Invitation accepted",
            "group_invite_rejected": "Invitation declined",
            "group_invite_sent": "Invitation sent",
            "group_invite_gone": "Group no longer available",
            "sys_user_joined": "{user} joined the group",
            "sys_user_left": "{user} left the group",
            "sys_user_kicked": "{user} was removed from the group",
            "sys_admin_left": "{user} (admin) left — the group is now closed",
            "group_locked_notice": "Group closed: the admin left. Messaging is disabled.",
            "group_admin_leave_confirm": "You are the admin. After you leave, the group will be closed for messaging. Continue?",
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
            "attach_photo": "Photo",
            "publish_post": "Publish post",
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
            "eula_text": "READ THIS AGREEMENT CAREFULLY BEFORE INSTALLING OR USING THE SOFTWARE.\n\nThis End User License Agreement (hereinafter — the 'Agreement') is a legally binding contract between You (an individual or legal entity, hereinafter — the 'User') and the Author of the project (hereinafter — the 'Licensor') regarding the software, including all related components, files, documentation and updates (hereinafter collectively — the 'Software').\n\nInstalling, running, copying or otherwise using the Software constitutes the User's full, unconditional and unreserved acceptance of all terms of this Agreement. If You do not agree with the terms of the Agreement, You may not install or use the Software and must immediately delete all copies of it from Your devices.\n\n1. GRANT OF LICENSE\n1.1. Limited license. The Licensor grants the User a non-exclusive, personal, non-transferable, revocable license to install and use the Software on devices lawfully owned by the User, solely for the purposes and in the ways provided by the technical documentation and this Agreement.\n1.2. Term. The license is granted for the entire term of the copyright in the Software, unless otherwise limited by the terms of acquisition of a specific version or the type of subscription.\n1.3. Reservation of rights. The Software is licensed, not sold. All ownership rights, copyrights and other intellectual property rights in the Software remain with the Licensor.\n\n2. RESTRICTIONS ON USE\n2.1. The User agrees not to perform, and not to allow third parties to perform, the following actions:\n- Reverse engineer, decompile, disassemble, modify, adapt, translate or otherwise attempt to derive the source code of the Software or any part thereof.\n- Create derivative works based on the Software.\n- Remove, alter, obscure or render invisible any copyright, trademark, service mark or other proprietary notices of the Licensor.\n- Use the Software to distribute malware, carry out cyberattacks, violate applicable law or infringe the rights of third parties.\n- Rent, lease, sublicense the Software or use it to provide commercial services to third parties without the prior written consent of the Licensor.\n\n3. FULL DISCLAIMER OF WARRANTIES\n3.1. Provided 'As Is'. The Software is provided to the User on an 'AS IS' and 'AS AVAILABLE' basis. The Licensor makes no warranties of any kind, whether express or implied, statutory or otherwise.\n3.2. Exclusion of implied warranties. The Licensor expressly disclaims any implied warranties, including, but not limited to: warranties of merchantability, fitness for a particular or specific purpose, uninterrupted and error-free operation of the Software, compatibility with any other software or hardware, as well as warranties of non-infringement of the rights of third parties.\n3.3. Responsibility for selection. The User is solely and fully responsible for selecting the Software to achieve the results they require, as well as for the installation, use and results obtained with the Software. All risks relating to the quality and performance of the Software rest solely with the User.\n\n4. LIMITATION OF LIABILITY AND WAIVER OF DAMAGES\n4.1. Exclusion of liability. Under no circumstances shall the Licensor, its partners, employees, agents or suppliers be liable to the User or any third parties for any direct, indirect, incidental, special, punitive or consequential damages arising from the use of or inability to use the Software.\n4.2. Types of excluded damages. This limitation applies, among other things, to:\n- Lost profit, loss of anticipated profit, commercial revenue or savings;\n- Loss, damage, corruption or destruction of data, databases or other information;\n- Termination or suspension of business activity, production downtime;\n- Failures of computer, server or network equipment;\n- Any other tangible or intangible losses arising under contract, tort (including negligence), breach of warranty or other legal grounds, even if the Licensor was warned in advance of the possibility of such damages or could have foreseen them.\n\n5. PRIVACY POLICY AND DATA PROTECTION\n5.1. Privacy first. The Licensor respects the User's right to privacy. The Software is designed to minimize the processing of any data.\n5.2. No collection of personal data. The Software does not collect, transmit, store or process the User's personal data (including, but not limited to: names, email addresses, passwords, payment information, IP addresses, geolocation or files on the device).\n5.3. Local processing. All data entered by the User, generated by the Software or processed during its operation is stored and processed solely on the User's local device. The Software does not send this data to external servers of the Licensor or third parties.\n5.4. Anonymous technical diagnostics. The Software may send the Licensor automatic error reports (crash reports) solely for the purpose of improving software stability. Such reports are fully anonymized and contain only technical parameters (for example, the Software version, the operating system type, the error call stack). This data cannot be used to identify the User and is never disclosed to third parties.\n\n6. TERMINATION OF THE AGREEMENT\n6.1. This Agreement is effective until terminated.\n6.2. The User may terminate the Agreement at any time by ceasing to use the Software and completely deleting the Software and all copies of it from all of their devices.\n6.3. The Agreement terminates automatically and immediately, without any notice from the Licensor, if the User breaches any of the terms of this Agreement (including the restrictions in Section 2). Upon termination of the Agreement, the User must immediately cease using the Software and destroy all copies of it.\n\n7. FINAL PROVISIONS\n7.1. Severability. If any provision of this Agreement is held by a court of competent jurisdiction to be invalid, illegal or unenforceable, this shall not affect the validity and enforceability of the remaining provisions of the Agreement, which shall remain in full force.\n7.2. Entire agreement. This Agreement constitutes the entire agreement between the User and the Licensor regarding the Software and supersedes any prior oral or written arrangements, agreements or representations.\n7.3. Amendments. The Licensor reserves the right to change the terms of this Agreement when releasing Software updates. Continued use of the Software after changes are made constitutes the User's acceptance of the new version of the Agreement.\n\nCopyright (c) 2026, hworks.space. All rights reserved.",

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
            "admin_change_role": "Change Role",
            "no_info": "No information",
            "unsubscribe": "Unsubscribe",
            "subscribe": "Subscribe",
            "profile_no_reviews": "No reviews yet",
            "profile_add_friend": "Add Friend",
            "login_success": "Login successful!",
            "login_failed": "Invalid credentials.",
            "error_too_many_login_attempts": "Too many attempts. Please try again in 15 minutes.",
            "error_too_many_profile_updates": "Too many profile updates. Please try again in 15 minutes.",
            "error_too_many_searches": "Too many searches. Please try again in 5 minutes.",
            "error_too_many_code_attempts": "Too many verification code attempts. Please try again in 15 minutes.",
            "error_too_many_messages": "Too many messages. Please try again in 5 minutes.",
            "error_too_many_requests": "Too many requests. Please try again in 5 minutes.",
            "error_invalid_verify_code": "Invalid verification code.",
            "error_username_taken": "Username is already taken.",
            "error_email_taken": "Email is already registered.",
            "error_invalid_captcha": "Invalid captcha token.",
            "profile_scale_label": "UI Scale:",
            "profile_auto_update_label": "Auto Updates:",
            "profile_autostart_label": "Run at Windows Startup:"
        },
        ru: {
            // Navigation
            "nav_home": "Главная",
            "about_source": "Исходный код",
            "version_label": "Версия",
            "attach_video": "Видео",
            "attach_audio": "Аудио",
            "attach_file": "Прикрепить файл",
            "ctx_reply": "Ответить",
            "ctx_save": "Сохранить",
            "ctx_copy_link": "Копировать ссылку",
            "ctx_copy": "Копировать",
            "you": "Вы",
            "friends_add": "Добавить в друзья",
            "friends_delete": "Удалить друга",
            "friends_delete_confirm": "Вы уверены, что хотите удалить этого пользователя из друзей?",
            "friends_reject": "Отклонить",
            "friends_pending": "Ожидание",
            "friends_none": "У вас пока нет друзей",
            "friends_no_outgoing": "Вы не отправляли запросы",
            "admin_username_label": "Имя:",
            "admin_role_label": "Роль:",
            "admin_email_label": "Email:",
            "admin_password_label": "Пароль:",
            "admin_reg_date_label": "Дата рег.:",
            "admin_new_username_placeholder": "Новое имя",
            "admin_new_email_placeholder": "Новый email",
            "admin_hide_users_list": "Скрыть всех пользователей",
            "admin_delete_user_confirm": "Вы уверены, что хотите удалить этого пользователя?",
            "profile_appearance_title": "Внешний вид",
            "profile_theme_label": "Тема:",
            "profile_lang_label": "Язык:",
            "profile_saved_success": "Изменения сохранены",
            "theme_aero": "Aero",
            "theme_default": "DOS",
            "chat_delete_confirm": "Вы уверены, что хотите удалить это сообщение?",
            "confirm_are_you_sure": "Вы уверены?",
            "error_forbidden": "Доступ запрещён!",
            "error_user_not_found": "Пользователь не найден",
            "error_username_chars": "Имя может содержать только буквы, цифры, подчёркивание, точку и дефис",
            "error_username_length": "Имя должно быть от 3 до 20 символов",
            "login_required": "Пожалуйста, войдите в систему.",
            "login_required_profile": "Просмотр профиля доступен только авторизованным пользователям.",
            "not_specified": "Не указана",
            "register_captcha_required": "Пожалуйста, подтвердите, что вы не робот.",
            "register_success": "Успешно! Входим в профиль...",
            "nav_search": "Поиск",
            "nav_friends": "Друзья",
            "nav_chat": "ЛС",
            "nav_groups": "Группы",
            "create": "Создать",
            "groups_title": "Мои группы",
            "groups_create": "Создать группу",
            "groups_name_placeholder": "Название группы",
            "groups_empty": "У вас пока нет групп. Создайте свою!",
            "groups_back": "← К группам",
            "groups_channel_placeholder": "Название канала",
            "groups_add_channel": "+ Канал",
            "groups_select_channel": "Выберите канал",
            "group_members": "Участники",
            "group_admin_badge": "АДМИН",
            "group_add_member": "Пригласить друга",
            "group_no_friends_to_add": "Нет друзей для приглашения",
            "group_rename": "Переименовать группу",
            "group_rename_prompt": "Новое название группы:",
            "group_delete": "Удалить группу",
            "group_delete_confirm": "Удалить группу навсегда? Это действие необратимо.",
            "group_leave": "Покинуть группу",
            "group_leave_confirm": "Покинуть группу?",
            "group_kick": "Удалить",
            "group_kick_confirm": "Удалить этого участника?",
            "group_channel_delete_confirm": "Удалить этот канал?",
            "group_no_access": "Нет доступа к этой группе",
            "group_accept": "Принять",
            "group_reject": "Отклонить",
            "group_invite_label": "Приглашение в группу",
            "group_invite_accepted": "Приглашение принято",
            "group_invite_rejected": "Приглашение отклонено",
            "group_invite_sent": "Приглашение отправлено",
            "group_invite_gone": "Группа больше недоступна",
            "sys_user_joined": "{user} присоединился к группе",
            "sys_user_left": "{user} покинул группу",
            "sys_user_kicked": "{user} удалён из группы",
            "sys_admin_left": "{user} (админ) покинул группу — общение закрыто",
            "group_locked_notice": "Группа закрыта: админ покинул её. Общение недоступно.",
            "group_admin_leave_confirm": "Вы админ. После вашего выхода группа будет закрыта для общения. Продолжить?",
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
            "attach_photo": "Фото",
            "publish_post": "Опубликовать пост",
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
            "admin_change_role": "Сменить роль",
            "no_info": "Нет информации",
            "unsubscribe": "Отписаться",
            "subscribe": "Подписаться",
            "profile_no_reviews": "Отзывов пока нет",
            "profile_add_friend": "Добавить в друзья",
            "login_success": "Успешный вход!",
            "login_failed": "Неверные учетные данные.",
            "error_too_many_login_attempts": "Слишком много попыток. Попробуйте через 15 минут.",
            "error_too_many_profile_updates": "Слишком много обновлений профиля. Попробуйте через 15 минут.",
            "error_too_many_searches": "Слишком много поисковых запросов. Попробуйте через 5 минут.",
            "error_too_many_code_attempts": "Слишком много попыток ввода кода. Попробуйте через 15 минут.",
            "error_too_many_messages": "Слишком много сообщений. Попробуйте через 5 минут.",
            "error_too_many_requests": "Слишком много запросов. Попробуйте через 5 минут.",
            "error_invalid_verify_code": "Неверный код подтверждения.",
            "error_username_taken": "Имя пользователя уже занято.",
            "error_email_taken": "Email уже зарегистрирован.",
            "error_invalid_captcha": "Неверный токен капчи.",
            "profile_scale_label": "Масштаб интерфейса:",
            "profile_auto_update_label": "Автообновления:",
            "profile_autostart_label": "Запускать при старте системы:"
        },
        uk: {
            // Navigation
            "nav_home": "Головна",
            "about_source": "Вихідний код",
            "version_label": "Версія",
            "attach_video": "Відео",
            "attach_audio": "Аудіо",
            "attach_file": "Прикріпити файл",
            "ctx_reply": "Відповісти",
            "ctx_save": "Зберегти",
            "ctx_copy_link": "Копіювати посилання",
            "ctx_copy": "Копіювати",
            "you": "Ви",
            "friends_add": "Додати в друзі",
            "friends_delete": "Видалити друга",
            "friends_delete_confirm": "Ви впевнені, що хочете видалити цього користувача з друзів?",
            "friends_reject": "Відхилити",
            "friends_pending": "Очікування",
            "friends_none": "У вас поки немає друзів",
            "friends_no_outgoing": "Ви не надсилали запитів",
            "admin_username_label": "Ім'я:",
            "admin_role_label": "Роль:",
            "admin_email_label": "Email:",
            "admin_password_label": "Пароль:",
            "admin_reg_date_label": "Дата реєст.:",
            "admin_new_username_placeholder": "Нове ім'я",
            "admin_new_email_placeholder": "Новий email",
            "admin_hide_users_list": "Приховати всіх користувачів",
            "admin_delete_user_confirm": "Ви впевнені, що хочете видалити цього користувача?",
            "profile_appearance_title": "Зовнішній вигляд",
            "profile_theme_label": "Тема:",
            "profile_lang_label": "Мова:",
            "profile_saved_success": "Зміни збережено",
            "theme_aero": "Aero",
            "theme_default": "DOS",
            "chat_delete_confirm": "Ви впевнені, що хочете видалити це повідомлення?",
            "confirm_are_you_sure": "Ви впевнені?",
            "error_forbidden": "Доступ заборонено!",
            "error_user_not_found": "Користувача не знайдено",
            "error_username_chars": "Ім'я може містити лише літери, цифри, підкреслення, крапку та дефіс",
            "error_username_length": "Ім'я має бути від 3 до 20 символів",
            "login_required": "Будь ласка, увійдіть у систему.",
            "login_required_profile": "Перегляд профілю доступний лише авторизованим користувачам.",
            "not_specified": "Не вказано",
            "register_captcha_required": "Будь ласка, підтвердіть, що ви не робот.",
            "register_success": "Успішно! Входимо в профіль...",
            "nav_search": "Пошук",
            "nav_friends": "Друзі",
            "nav_chat": "ОП",
            "nav_groups": "Групи",
            "create": "Створити",
            "groups_title": "Мої групи",
            "groups_create": "Створити групу",
            "groups_name_placeholder": "Назва групи",
            "groups_empty": "У вас поки немає груп. Створіть свою!",
            "groups_back": "← До груп",
            "groups_channel_placeholder": "Назва каналу",
            "groups_add_channel": "+ Канал",
            "groups_select_channel": "Оберіть канал",
            "group_members": "Учасники",
            "group_admin_badge": "АДМІН",
            "group_add_member": "Запросити друга",
            "group_no_friends_to_add": "Немає друзів для запрошення",
            "group_rename": "Перейменувати групу",
            "group_rename_prompt": "Нова назва групи:",
            "group_delete": "Видалити групу",
            "group_delete_confirm": "Видалити групу назавжди? Цю дію не можна скасувати.",
            "group_leave": "Покинути групу",
            "group_leave_confirm": "Покинути групу?",
            "group_kick": "Видалити",
            "group_kick_confirm": "Видалити цього учасника?",
            "group_channel_delete_confirm": "Видалити цей канал?",
            "group_no_access": "Немає доступу до цієї групи",
            "group_accept": "Прийняти",
            "group_reject": "Відхилити",
            "group_invite_label": "Запрошення до групи",
            "group_invite_accepted": "Запрошення прийнято",
            "group_invite_rejected": "Запрошення відхилено",
            "group_invite_sent": "Запрошення надіслано",
            "group_invite_gone": "Група більше недоступна",
            "sys_user_joined": "{user} приєднався до групи",
            "sys_user_left": "{user} покинув групу",
            "sys_user_kicked": "{user} видалений з групи",
            "sys_admin_left": "{user} (адмін) покинув групу — спілкування закрито",
            "group_locked_notice": "Група закрита: адмін покинув її. Спілкування недоступне.",
            "group_admin_leave_confirm": "Ви адмін. Після вашого виходу групу буде закрито для спілкування. Продовжити?",
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
            "attach_photo": "Фото",
            "publish_post": "Опублікувати пост",
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
            "eula_title": "Ліцензійна угода (EULA)",
            "eula_text": "УВАЖНО ОЗНАЙОМТЕСЯ З ЦІЄЮ УГОДОЮ ПЕРЕД ВСТАНОВЛЕННЯМ АБО ВИКОРИСТАННЯМ ПРОГРАМНОГО ЗАБЕЗПЕЧЕННЯ.\n\nЦя Ліцензійна угода з кінцевим користувачем (далі — «Угода») є юридично обов'язковим договором, укладеним між Вами (фізичною або юридичною особою, далі — «Користувач») та Автором проєкту (далі — «Ліцензіар»), щодо програмного забезпечення, включно з усіма пов'язаними з ним компонентами, файлами, документацією та оновленнями (далі спільно — «Програма»).\n\nВстановлення, запуск, копіювання або інше використання Програми означає повну, безумовну та беззастережну згоду Користувача з усіма умовами цієї Угоди. Якщо Ви не згодні з умовами Угоди, Ви не маєте права встановлювати або використовувати Програму та зобов'язані негайно видалити всі її копії зі своїх пристроїв.\n\n1. НАДАННЯ ЛІЦЕНЗІЇ\n1.1. Обмежена ліцензія. Ліцензіар надає Користувачеві невиключну, особисту, непередавану, відкличну ліцензію на встановлення та використання Програми на пристроях, що перебувають у законному володінні Користувача, виключно з метою та у спосіб, передбачені технічною документацією та цією Угодою.\n1.2. Строк дії. Ліцензія надається на весь строк дії авторських прав на Програму, якщо інше не обмежено умовами придбання конкретної версії або типом підписки.\n1.3. Збереження прав. Програма ліцензується, а не продається. Усі права власності, авторські права та інші права інтелектуальної власності на Програму залишаються за Ліцензіаром.\n\n2. ОБМЕЖЕННЯ ВИКОРИСТАННЯ\n2.1. Користувач зобов'язується не вчиняти особисто та не дозволяти третім особам вчиняти такі дії:\n- Розкривати технологію, декомпілювати, розбирати, дизасемблювати, модифікувати, адаптувати, перекладати або іншим чином намагатися отримати вихідний код Програми чи будь-якої її частини.\n- Створювати похідні продукти на основі Програми.\n- Видаляти, змінювати, приховувати або робити невидимими будь-які повідомлення про авторські права, товарні знаки, торгові марки чи інші права власності Ліцензіара.\n- Використовувати Програму для розповсюдження шкідливого ПЗ, здійснення кібератак, порушення чинного законодавства або утиску прав третіх осіб.\n- Здавати Програму в оренду, прокат, субліцензувати або використовувати її для надання комерційних послуг третім особам без попередньої письмової згоди Ліцензіара.\n\n3. ПОВНА ВІДМОВА ВІД ГАРАНТІЙ\n3.1. Надання «Як є». Програма надається Користувачеві на умовах «ЯК Є» (AS IS) та «У МІРУ ДОСТУПНОСТІ» (AS AVAILABLE). Ліцензіар не надає жодних гарантій, явних чи неявних, законодавчих чи інших.\n3.2. Виключення неявних гарантій. Ліцензіар прямо відмовляється від будь-яких неявних гарантій, включно, зокрема: гарантії товарного стану (комерційної цінності), придатності для конкретної або визначеної мети, безперебійної та безпомилкової роботи Програми, сумісності з будь-яким іншим програмним забезпеченням чи апаратними засобами, а також гарантії відсутності порушень прав третіх осіб.\n3.3. Відповідальність за вибір. Користувач одноосібно несе повну відповідальність за вибір Програми для досягнення необхідних йому результатів, а також за встановлення, використання та результати, отримані за допомогою Програми. Усі ризики, пов'язані з якістю та продуктивністю Програми, лежать виключно на Користувачі.\n\n4. ОБМЕЖЕННЯ ВІДПОВІДАЛЬНОСТІ ТА ЗВІЛЬНЕННЯ ВІД ЗБИТКІВ\n4.1. Виключення відповідальності. За жодних обставин Ліцензіар, його партнери, співробітники, агенти чи постачальники не несуть відповідальності перед Користувачем або будь-якими третіми особами за будь-які прямі, непрямі, випадкові, спеціальні, штрафні чи подальші збитки, що виникли внаслідок використання або неможливості використання Програми.\n4.2. Види виключених збитків. Це обмеження поширюється, зокрема, на:\n- Упущену вигоду, втрату очікуваного прибутку, комерційного доходу чи заощаджень;\n- Втрату, пошкодження, спотворення чи знищення даних, баз даних або іншої інформації;\n- Припинення або призупинення ділової активності, простої виробництва;\n- Збої в роботі комп'ютерного, серверного чи мережевого обладнання;\n- Будь-які інші матеріальні чи нематеріальні втрати, що виникли на підставі договору, делікту (включно з недбалістю), порушення гарантій чи інших правових підстав, навіть якщо Ліцензіара було заздалегідь попереджено про можливість настання таких збитків або він міг їх передбачити.\n\n5. ПОЛІТИКА КОНФІДЕНЦІЙНОСТІ ТА ЗАХИСТ ДАНИХ\n5.1. Пріоритет приватності. Ліцензіар поважає право Користувача на конфіденційність. Програму спроєктовано таким чином, щоб мінімізувати обробку будь-яких даних.\n5.2. Відсутність збору персональних даних. Програма не збирає, не передає, не зберігає та не обробляє персональні дані Користувача (включно, але не обмежуючись: імена, адреси електронної пошти, паролі, платіжну інформацію, IP-адреси, геолокацію чи файли на пристрої).\n5.3. Локальна обробка. Усі дані, що вводяться Користувачем, генеруються Програмою або обробляються під час її роботи, зберігаються та обробляються виключно на локальному пристрої Користувача. Програма не надсилає ці дані на зовнішні сервери Ліцензіара чи третіх осіб.\n5.4. Анонімна технічна діагностика. Програма може надсилати Ліцензіару автоматичні звіти про помилки (crash reports) виключно з метою покращення стабільності ПЗ. Ці звіти є повністю знеособленими (анонімними) та містять лише технічні параметри (наприклад, версія Програми, тип операційної системи, стек викликів помилки). Ці дані не можуть бути використані для ідентифікації особи Користувача та ніколи не передаються третім сторонам.\n\n6. ПРИПИНЕННЯ ДІЇ УГОДИ\n6.1. Ця Угода діє до моменту її розірвання.\n6.2. Користувач може розірвати Угоду будь-якої миті, припинивши використання Програми та повністю видаливши Програму й усі її копії з усіх своїх пристроїв.\n6.3. Угода припиняє свою дію автоматично та негайно, без будь-якого повідомлення з боку Ліцензіара, у разі порушення Користувачем будь-якої з умов цієї Угоди (включно з обмеженнями розділу 2). При припиненні дії Угоди Користувач зобов'язаний негайно припинити використання Програми та знищити всі її копії.\n\n7. ЗАКЛЮЧНІ ПОЛОЖЕННЯ\n7.1. Автономність положень. Якщо будь-яке положення цієї Угоди буде визнано судом компетентної юрисдикції недійсним, незаконним чи таким, що не має юридичної сили, це не вплине на дійсність та застосовність решти положень Угоди, які збережуть повну силу.\n7.2. Повнота Угоди. Ця Угода становить повну угоду між Користувачем та Ліцензіаром щодо Програми та замінює собою будь-які попередні усні чи письмові домовленості, угоди або заяви.\n7.3. Зміни. Ліцензіар залишає за собою право змінювати умови цієї Угоди при випуску оновлень Програми. Продовження використання Програми після внесення змін означає згоду Користувача з новою редакцією Угоди.\n\nCopyright (c) 2026, hworks.space. Усі права захищено.",

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
            "admin_change_role": "Змінити роль",
            "no_info": "Немає інформації",
            "unsubscribe": "Відписатися",
            "subscribe": "Підписатися",
            "profile_no_reviews": "Відгуків поки немає",
            "profile_add_friend": "Додати в друзі",
            "login_success": "Успішний вхід!",
            "login_failed": "Невірні облікові дані.",
            "error_too_many_login_attempts": "Занадто багато спроб. Спробуйте через 15 хвилин.",
            "error_too_many_profile_updates": "Занадто багато оновлень профілю. Спробуйте через 15 хвилин.",
            "error_too_many_searches": "Занадто багато пошукових запитів. Спробуйте через 5 хвилин.",
            "error_too_many_code_attempts": "Занадто багато спроб введення коду. Спробуйте через 15 хвилин.",
            "error_too_many_messages": "Занадто багато повідомлень. Спробуйте через 5 хвилин.",
            "error_too_many_requests": "Занадто багато запитів. Спробуйте через 5 хвилин.",
            "error_invalid_verify_code": "Невірний код підтвердження.",
            "error_username_taken": "Ім'я користувача вже зайняте.",
            "error_email_taken": "Email вже зареєстрований.",
            "error_invalid_captcha": "Невірний токен капчі.",
            "profile_scale_label": "Масштаб інтерфейсу:",
            "profile_auto_update_label": "Автооновлення:",
            "profile_autostart_label": "Запускати при старті системи:"
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

    window.tErr = function(errText, fallback = '') {
        if (!errText) return fallback || errText;
        const cleanErr = errText.trim().replace(/\.$/, '');
        
        const errorMap = {
            'Слишком много попыток. Попробуйте через 15 минут': 'error_too_many_login_attempts',
            'Слишком много обновлений профиля. Попробуйте через 15 минут': 'error_too_many_profile_updates',
            'Слишком много поисковых запросов. Попробуйте через 5 минут': 'error_too_many_searches',
            'Слишком много попыток ввода кода. Попробуйте через 15 минут': 'error_too_many_code_attempts',
            'Слишком много сообщений. Попробуйте через 5 минут': 'error_too_many_messages',
            'Слишком много запросов. Попробуйте через 5 минут': 'error_too_many_requests',
            'Неверные учетные данные': 'login_failed',
            'Неверный код подтверждения': 'error_invalid_verify_code',
            'Имя пользователя уже занято': 'error_username_taken',
            'Email уже зарегистрирован': 'error_email_taken',
            'Неверный токен капчи': 'error_invalid_captcha',
            'Пароль не соответствует требованиям безопасности': 'register_error_requirements'
        };

        const key = errorMap[cleanErr];
        if (key) {
            return window.t(key, errText);
        }
        return window.t(errText, fallback || errText);
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
    window.applyTheme = function applyTheme() {
        const theme = localStorage.getItem('app_theme') || 'default';
        const themeFile = theme === 'aero' ? 'aero.css' : 'default.css';
        
        let themeLink = document.getElementById('theme-stylesheet');
        
        if (!themeLink) {
            themeLink = document.createElement('link');
            themeLink.id = 'theme-stylesheet';
            themeLink.rel = 'stylesheet';
            themeLink.href = themeFile;
            if (document.head) {
                document.head.appendChild(themeLink);
            } else {
                document.documentElement.appendChild(themeLink);
            }
        } else {
            if (!themeLink.href.endsWith(themeFile)) {
                themeLink.href = themeFile;
            }
        }

        // Очищаем старые классы, так как теперь темы полностью автономны
        document.documentElement.classList.remove('theme-aero');
        if (document.body) document.body.classList.remove('theme-aero');
    }

    window.applyScale = function applyScale() {
        const scale = localStorage.getItem('app_scale') || '1.0';
        document.documentElement.style.zoom = scale;
    };
    applyScale();

    // Применяем тему сразу для предотвращения FOUC
    applyTheme();

    document.addEventListener("DOMContentLoaded", () => {
        applyScale();
        applyTheme();
        window.applyTranslations();
        bindLanguageButtons();
    });
    
    // При навигации через SPA (например, при переходе в профиль) появляются новые кнопки смены языка, их нужно биндить
    document.addEventListener("spa:navigate", () => {
        applyScale();
        applyTheme();
        window.applyTranslations();
        bindLanguageButtons();
    });


    window.addEventListener("load", () => {
        applyScale();
        applyTheme();
        window.applyTranslations();
        bindLanguageButtons();
    });
})();
