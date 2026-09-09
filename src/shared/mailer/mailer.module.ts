import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { EMAIL_PROVIDER } from "./email.constant";
import { DevEmailProvider } from "./providers/dev-email.provider";

@Module({
  providers: [
    EmailService,
    {
      provide: EMAIL_PROVIDER,
      useClass: DevEmailProvider,
    },
  ],
  exports: [EmailService, EMAIL_PROVIDER],
})
export class MailerModule {}
