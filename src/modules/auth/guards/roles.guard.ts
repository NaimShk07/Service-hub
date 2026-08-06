import { ROLES_KEY } from "@common/decorators/roles.decorator";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma-client/enums";

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRole = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRole || requiredRole.length === 0) return true;

    const request = context.switchToHttp().getRequest();

    if (!request.user || !request.user.role) {
      throw new ForbiddenException("Access denied");
    }

    if (requiredRole.includes(request.user.role)) {
      return true;
    } else {
      throw new ForbiddenException(
        "You do not have permission to access this resource",
      );
    }
  }
}
