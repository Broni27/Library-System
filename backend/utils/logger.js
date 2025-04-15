// backend/utils/logger.js
module.exports = {
    /**
     * Логирование ошибок БД
     * @param {string} context - Контекст ошибки
     * @param {Error} error - Объект ошибки
     */
    logDatabaseError: (context, error) => {
        console.error(`[DATABASE ERROR] ${context}:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            time: new Date().toISOString()
        });
    },

    /**
     * Логирование HTTP запросов
     * @param {Request} req - Объект запроса
     * @param {Response} res - Объект ответа
     * @param {Error} error - Объект ошибки
     */
    logHttpError: (req, res, error) => {
        console.error(`[HTTP ERROR] ${req.method} ${req.path}:`, {
            params: req.params,
            body: req.body,
            error: error.message,
            status: res.statusCode,
            time: new Date().toISOString()
        });
    }
};