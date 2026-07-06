const db = require('../config/db');
const logger = require('../config/logger');

// Единая иерархия ролей
const ROLE_HIERARCHY = {
    'banned': 0,
    'newbie': 1,
    'user': 2,
    'premium': 3,
    'vip': 4,
    'moderator': 5,
    'admin': 6
};

// Получить роль пользователя из БД
const getUserRole = (userId) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT role FROM users WHERE id = ?', [userId], (error, results) => {
            if (error) return reject(error);
            if (results.length === 0) return reject(new Error('User not found'));
            resolve(results[0].role);
        });
    });
};

// Middleware: проверка на конкретную роль
const requireRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const userRole = await getUserRole(userId);
            
            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({ error: 'Access Denied: Insufficient permissions' });
            }

            req.user.role = userRole;
            next();
        } catch (error) {
            logger.error('Error checking user role:', error);
            res.status(500).json({ error: 'Error checking permissions' });
        }
    };
};

// Middleware: подгружает роль пользователя в req.user.role БЕЗ ограничения доступа.
// Нужен для маршрутов, где доступ открыт всем авторизованным, но логика зависит от роли
// (например, создание поста: news — всем, patch_note — только admin/moderator).
const loadRole = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        req.user.role = await getUserRole(userId);
        next();
    } catch (error) {
        logger.error('Error loading user role:', error);
        res.status(500).json({ error: 'Error checking permissions' });
    }
};

// Middleware: проверка на админа или модератора
const requireAdminOrModerator = requireRole(['admin', 'moderator']);

// Middleware: проверка только на админа
const requireAdmin = requireRole(['admin']);

// Middleware: проверка иерархии (актор не может редактировать цель с ролью >= своей)
const requireHierarchy = (req, res, next) => {
    const actorRole = req.user?.role;
    const targetId = req.params.id;

    if (!actorRole) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Админ может всё
    if (actorRole === 'admin') {
        return next();
    }

    // Получаем роль цели
    db.query('SELECT role FROM users WHERE id = ?', [targetId], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database error checking target role' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const targetRole = results[0].role;
        const actorLevel = ROLE_HIERARCHY[actorRole] || 0;
        const targetLevel = ROLE_HIERARCHY[targetRole] || 0;

        // Модератор не может редактировать админов и других модераторов
        if (actorRole === 'moderator') {
            if (parseInt(targetId) === parseInt(req.user.id)) {
                return res.status(403).json({ error: 'Недостаточно прав: модератор не может изменять свои собственные данные' });
            }
            if (targetLevel >= 5) {
                return res.status(403).json({ error: 'Недостаточно прав: модератор не может изменять администраторов и других модераторов' });
            }
        }

        // Проверка: актор не может редактировать пользователей с ролью >= своей
        if (targetLevel >= actorLevel) {
            return res.status(403).json({ error: 'Недостаточно прав для редактирования этого пользователя' });
        }

        next();
    });
};

module.exports = {
    requireRole,
    requireAdmin,
    requireAdminOrModerator,
    requireHierarchy,
    loadRole,
    ROLE_HIERARCHY
};