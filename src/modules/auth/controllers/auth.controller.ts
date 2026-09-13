import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { AuthService } from "../services/auth.service";
import { RegisterDto } from "../dto/register.dto";
import { ConfigService } from "@nestjs/config";
import { Response, Request } from "express";
import { LoginDto } from "../dto/login.dto";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Auth } from "@common/decorators/auth.decorator";

@Controller("auth")
@ApiTags("Auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.register(dto);
    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: this.configService.get("app.nodeEnv") === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/v1/auth",
    });
    return { user: data.user, accessToken: data.accessToken };
  }

  /**
   * Log in user
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.login(dto);
    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: this.configService.get("app.nodeEnv") === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/v1/auth",
    });
    return { user: data.user, accessToken: data.accessToken };
  }

  /**
   * Refresh access token using refresh cookie
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies.refreshToken;
    const data = await this.authService.refresh(refreshToken);
    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: this.configService.get("app.nodeEnv") === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/v1/auth",
    });
    return { user: data.user, accessToken: data.accessToken };
  }

  /**
   * Log out user and clear refresh cookie
   */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @Auth()
  async logout(
    @CurrentUser("userId") userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.logout(userId);
    res.clearCookie("refreshToken", { path: "/api/v1/auth" });
    return data;
  }

  /**
   * Get current authenticated user profile
   */
  @Get("me")
  @Auth()
  async profile(@CurrentUser() user: any) {
    const data = await this.authService.getProfile(user.userId);
    return data;
  }
}
