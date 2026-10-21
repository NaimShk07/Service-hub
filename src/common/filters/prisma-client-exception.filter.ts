import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma-client/client";
import { Request, Response } from "express";
import { getRequestId } from "../logging/request-context";

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = process.env.NODE_ENV === "production";
    const requestId = (request as any).requestId || getRequestId();

    let status: number;
    let message: string;

    switch (exception.code) {
      case "P2034":
      case "P2039":
      case "P2002": {
        const target = exception.meta?.target as string[] | undefined;
        status = HttpStatus.CONFLICT;
        message =
          exception.message?.includes("no_provider_booking_overlap") ||
          exception.message?.includes("exclusion")
            ? "This time slot is no longer available."
            : isProduction
              ? "A duplicate record already exists."
              : target
                ? `Unique constraint violation on field: ${target.join(", ")}`
                : "Conflict occurred";
        break;
      }
      case "P2025": {
        status = HttpStatus.NOT_FOUND;
        message = isProduction
          ? "Requested record not found"
          : (exception.meta?.cause as string) || "Record not found";
        break;
      }
      case "P2003": {
        status = HttpStatus.BAD_REQUEST;
        message = isProduction
          ? "Invalid reference to a related resource."
          : `Foreign key constraint failed on field: ${exception.meta?.field_name}`;
        break;
      }
      default: {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = "Internal server error";
        break;
      }
    }

    this.logger.error(
      `Database error [${exception.code}] on ${request.method} ${request.url}: ${exception.message}`,
      {
        code: exception.code,
        meta: exception.meta,
        requestId,
        path: request.url,
      },
    );

    response.status(status).json({
      statusCode: status,
      success: false,
      message,
      error: status === 500 ? "Internal Server Error" : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId ? { requestId } : {}),
    });
  }
}
