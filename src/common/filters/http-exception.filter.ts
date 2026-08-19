import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

interface HttpExceptionResponseBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
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

    response.status(status).json({
      statusCode: status,
      success: false,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
