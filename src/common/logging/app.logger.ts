import { ConsoleLogger, Injectable, Scope } from "@nestjs/common";
import { getRequestId, getRequestUserId } from "./request-context";
import { sanitizeLogData } from "./sanitizer.util";

@Injectable({ scope: Scope.DEFAULT })
export class AppLogger extends ConsoleLogger {
  private formatStructured(
    level: string,
    message: any,
    optionalParams: any[],
  ): string {
    let context = this.context;
    let meta: Record<string, any> = {};

    for (let i = optionalParams.length - 1; i >= 0; i--) {
      const param = optionalParams[i];
      if (typeof param === "string") {
        if (param.includes("\n") || param.startsWith("Error:")) {
          meta.stack = param;
        } else if (!context) {
          context = param;
        }
      } else if (typeof param === "object" && param !== null) {
        meta = { ...meta, ...sanitizeLogData(param) };
      }
    }

    let msg = message;
    if (typeof message === "object" && message !== null) {
      const sanitized = sanitizeLogData(message);
      meta = { ...meta, ...sanitized };
      msg = sanitized.message || JSON.stringify(sanitized);
    } else if (typeof message === "string") {
      msg = sanitizeLogData(message);
    }

    const requestId = getRequestId();
    const userId = getRequestUserId();

    const logEntry: Record<string, any> = {
      level,
      message: msg,
      ...(requestId ? { requestId } : {}),
      ...(userId ? { userId } : {}),
      context: context || "Application",
      ...meta,
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(logEntry);
  }

  log(message: any, ...optionalParams: any[]) {
    if (process.env.LOG_FORMAT === "text") {
      super.log(message, ...optionalParams);
    } else {
      process.stdout.write(
        this.formatStructured("info", message, optionalParams) + "\n",
      );
    }
  }

  error(message: any, ...optionalParams: any[]) {
    if (process.env.LOG_FORMAT === "text") {
      super.error(message, ...optionalParams);
    } else {
      process.stderr.write(
        this.formatStructured("error", message, optionalParams) + "\n",
      );
    }
  }

  warn(message: any, ...optionalParams: any[]) {
    if (process.env.LOG_FORMAT === "text") {
      super.warn(message, ...optionalParams);
    } else {
      process.stdout.write(
        this.formatStructured("warn", message, optionalParams) + "\n",
      );
    }
  }

  debug(message: any, ...optionalParams: any[]) {
    if (process.env.LOG_FORMAT === "text") {
      super.debug(message, ...optionalParams);
    } else {
      process.stdout.write(
        this.formatStructured("debug", message, optionalParams) + "\n",
      );
    }
  }
}
