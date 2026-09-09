export interface SendEmailOption {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailProvider {
  sendEmail(options: SendEmailOption): Promise<EmailSendResult>;
}
