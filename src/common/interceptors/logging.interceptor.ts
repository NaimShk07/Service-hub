import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { tap } from "rxjs";
import { setRequestUserId } from "../logging/request-context";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          if (request.user?.id) {
            setRequestUserId(request.user.id);
          }
          this.logger.log(`${request.method} ${request.url} completed`, {
            method: request.method,
            url: request.url,
            statusCode: response.statusCode,
            durationMs: duration,
            userId: request.user?.id,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          if (request.user?.id) {
            setRequestUserId(request.user.id);
          }
          this.logger.error(
            `${request.method} ${request.url} failed: ${error?.message || "Unknown error"}`,
            {
              method: request.method,
              url: request.url,
              statusCode: error?.status || response.statusCode || 500,
              durationMs: duration,
              userId: request.user?.id,
              error: error?.message,
            },
          );
        },
      }),
    );
  }
}
