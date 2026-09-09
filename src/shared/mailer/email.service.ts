import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  EmailSendResult,
  IEmailProvider,
  SendEmailOption,
} from "./interfaces/email-provider.interfaces";
import { EMAIL_PROVIDER } from "./email.constant";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
  ) {}

  async sendEmail(options: SendEmailOption): Promise<EmailSendResult> {
    if (!options.to || !options.to.includes("@")) {
      throw new Error(`Invalid recipient email address: "${options.to}"`);
    }

    const result = await this.emailProvider.sendEmail(options);

    if (!result.success) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${result.error || "Provider failure"}`,
      );
      throw new Error(result.error || "Email provider failed to deliver email");
    }

    return result;
  }
}
