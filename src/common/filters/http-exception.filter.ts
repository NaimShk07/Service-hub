import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { getRequestId } from "../logging/request-context";

interface HttpExceptionResponseBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = "Internal server error";
    let error: string | undefined;

    if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
      const responseObj = exceptionResponse as HttpExceptionResponseBody;
      if (responseObj.message) {
        message = responseObj.message;
      }
      if (responseObj.error) {
        error = responseObj.error;
      }
    } else if (typeof exceptionResponse === "string") {
      message = exceptionResponse;
    } else if (exception instanceof Error) {
      message =
        status !== 500 && process.env.NODE_ENV !== "production"
          ? exception.message
          : "Internal Server Error";
    }

    const requestId = (request as any).requestId || getRequestId();

    // Log the error with structured context
    const logMethod = status >= 500 ? "error" : "warn";
    this.logger[logMethod](
      `HTTP ${status} on ${request.method} ${request.url}: ${Array.isArray(message) ? message.join(", ") : message}`,
      {
        statusCode: status,
        path: request.url,
        method: request.method,
        requestId,
        error: error || (exception instanceof Error ? exception.message : undefined),
      },
    );

    // Special handling for Terminus HealthCheck errors to preserve standard diagnostic structure
    if (
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null &&
      "status" in exceptionResponse &&
      (exceptionResponse as any).status === "error"
    ) {
      return response.status(status).json({
        ...(exceptionResponse as object),
        ...(requestId ? { requestId } : {}),
      });
    }

    response.status(status).json({
      statusCode: status,
      success: false,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId ? { requestId } : {}),
    });

  }
}

