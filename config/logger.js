const isProduction = process.env.NODE_ENV === 'production';

const logger = {
    error: (message, error) => {
        if (isProduction) {
            // В production логируем только общее сообщение без чувствительных данных
            console.error('ERROR:', message);
        } else {
            console.error('ERROR:', message, error);
        }
    },
    info: (message) => {
        if (!isProduction) {
            console.info('INFO:', message);
        }
    }
};

module.exports = logger;