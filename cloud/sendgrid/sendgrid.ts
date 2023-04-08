import logger from '@util/logger';
import { SendGridConfiguration } from '../../config/config';
import sendgrid, { MailService } from '@sendgrid/mail'

export function newSendGrid(config: SendGridConfiguration) {
    sendgrid.setApiKey(config.apiKey)
    return new SendGrid(config.senderEmail, sendgrid)
}

interface Service {
    sendEmailTemplate(subject: string, html: string, ...to: string[]): void
}

export class SendGrid implements Service {
    constructor(private senderEmail: string, private sendgrid: MailService) {}

    sendEmailTemplate(subject: string, html: string, ...to: string[]) {
        logger.info(`Start cloud.sendgrid.sendEmailTemplate, "input": ${JSON.stringify({subject, html, to})}`)
        const msg = {
            to,
            from: this.senderEmail,
            subject,
            // text: 'and easy to do anywhere, even with Node.js',
            html,
        }
        this.sendgrid.send(msg)
            .then(data => logger.info(`send email template to ${to} successfully: ${data?.length || 0} email(s)`))
            .catch((error) => console.error(error))
        logger.info(`End cloud.sendgrid.sendEmailTemplate`)
    }
}