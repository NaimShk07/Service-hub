import { Injectable, Logger } from "@nestjs/common";
import {
  EmailSendResult,
  IEmailProvider,
  SendEmailOption,
} from "../interfaces/email-provider.interfaces";

@Injectable()
export class DevEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(DevEmailProvider.name);

  async sendEmail(options: SendEmailOption): Promise<EmailSendResult> {
    this.logger.log(`📧 [EMAIL OUTBOX] Delivering to: <${options.to}>`);
    this.logger.log(`📧 Subject: ${options.subject}`);
    this.logger.log(`📧 Content: ${options.text || options.html}`);

    // Simulated provider message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      success: true,
      messageId,
    };
  }
}
