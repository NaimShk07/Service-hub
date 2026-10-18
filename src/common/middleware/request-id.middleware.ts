import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { requestContext } from "../logging/request-context";

// Safe pattern for incoming request IDs: 1-64 alphanumeric, dash, underscore
const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incomingHeader = req.headers["x-request-id"];
    let requestId: string;

    if (
      typeof incomingHeader === "string" &&
      SAFE_REQUEST_ID_REGEX.test(incomingHeader.trim())
    ) {
      requestId = incomingHeader.trim();
    } else {
      requestId = `req_${randomUUID()}`;
    }

    // Attach to request object for easy handler access
    (req as any).requestId = requestId;

    // Set response header for client correlation
    res.setHeader("X-Request-ID", requestId);

    // Run inside AsyncLocalStorage context so that all services and loggers down the chain inherit requestId
    requestContext.run({ requestId }, () => {
      next();
    });
  }
}
