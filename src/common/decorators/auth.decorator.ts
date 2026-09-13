import { applyDecorators, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Role } from "@prisma-client/enums";
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard";
import { RoleGuard } from "@modules/auth/guards/roles.guard";
import { Roles } from "./roles.decorator";

/**
 * Composite Auth Decorator
 * Combines JwtAuthGuard, RoleGuard (if roles specified), and Swagger Bearer Auth & error responses.
 *
 * Usage:
 *   @Auth()                   // Any authenticated user
 *   @Auth(Role.CUSTOMER)      // Customer only
 *   @Auth(Role.ADMIN, Role.PROVIDER) // Admin or Provider
 */
export function Auth(...roles: Role[]) {
  if (roles.length > 0) {
    return applyDecorators(
      Roles(...roles),
      UseGuards(JwtAuthGuard, RoleGuard),
      ApiBearerAuth(),
      ApiUnauthorizedResponse({
        description: "Unauthorized - Authentication token missing or invalid",
      }),
      ApiForbiddenResponse({
        description: "Forbidden - Insufficient role permissions",
      }),
    );
  }

  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: "Unauthorized - Authentication token missing or invalid",
    }),
  );
}
