import { createLogger, format, transports } from "winston";

const logger = createLogger({
    level: 'debug',
    format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(info => `{"time": "${info.timestamp}", "level": "${info.level}", "message": "${info.message}"}`)
    ),
    transports: [new transports.Console()]
})

export default logger