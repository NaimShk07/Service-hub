import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import { Prisma } from "@prisma-client/client";
import { Request, Response } from "express";

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    switch (exception.code) {
      case "P2002": {
        const target = exception.meta?.target as string[] | undefined;
        status = HttpStatus.CONFLICT;
        message = target
          ? `Unique constraint violation on field: ${target.join(", ")}`
          : "Slot or unique record conflict occurred";
        break;
      }
      case "P2025": {
        status = HttpStatus.NOT_FOUND;
        message = (exception.meta?.cause as string) || "Record not found";
        break;
      }
      case "P2003": {
        status = HttpStatus.BAD_REQUEST;
        message = `Foreign key constraint failed on field: ${exception.meta?.field_name}`;
        break;
      }
      default: {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = "Internal server error";
        break;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
