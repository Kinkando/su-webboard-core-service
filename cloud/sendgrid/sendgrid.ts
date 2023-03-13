import { SendGridConfiguration } from '@config/config';
import sendgrid, { MailService } from '@sendgrid/mail'

export function newSendGrid(config: SendGridConfiguration) {
    sendgrid.setApiKey(config.apiKey)
    return new SendGrid(config.senderEmail, sendgrid)
}

interface Service {
    sendEmailTemplate(to: string): void
}

export class SendGrid implements Service {
    constructor(private senderEmail: string, private sendgrid: MailService) {}

    sendEmailTemplate(to: string) {
        const msg = {
            to: 'noreply.suwebboard@gmail.com', // Change to your recipient
            from: this.senderEmail, // Change to your verified sender
            subject: 'Sending with SendGrid is Fun',
            text: 'and easy to do anywhere, even with Node.js',
            html: '<strong>and easy to do anywhere, even with Node.js</strong>',
        }
        this.sendgrid.send(msg)
            .then(() => {
                console.log('Email sent')
            })
            .catch((error) => {
                console.error(error)
            })
    }
}