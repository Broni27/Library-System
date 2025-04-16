// backend/utils/logger.js
module.exports = {
    /**
     * Database error logging
     * @param {string} context - Error context
     * @param {Error} error - Error object
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
     * Logging HTTP requests
     * @param {Request} req - Request object
     * @param {Response} res - Response object
     * @param {Error} error - Error object
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