import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Response as ExpressResponse } from "express";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface ApiResponse<T> {
  statusCode: number;
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<ExpressResponse>();
    const statusCode = response.statusCode;

    // Preserve standard health check probe payloads for k8s and infrastructure monitors
    if (request.url?.includes("/health")) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: T) => ({
        statusCode,
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
