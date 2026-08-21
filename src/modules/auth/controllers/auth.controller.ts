import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "../services/auth.service";
import { RegisterDto } from "../dto/register.dto";
import { ConfigService } from "@nestjs/config";
import { Response, Request } from "express";
import { LoginDto } from "../dto/login.dto";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

@Controller("auth")
@ApiTags("Auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per 60 seconds
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User successfully registered" })
  @ApiResponse({
    status: 400,
    description: "Validation error or email/phone already exists",
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.register(dto);
    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: this.configService.get("app.nodeEnv") === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth",
    });
    return { user: data.user, accessToken: data.accessToken };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per 60 seconds
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log in user" })
  @ApiResponse({ status: 200, description: "User successfully logged in" })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Invalid email or password" })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.login(dto);
    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: this.configService.get("app.nodeEnv") === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth",
    });
    return { user: data.user, accessToken: data.accessToken };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per 60 seconds
  @Post("/refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token using refresh cookie" })
  @ApiResponse({
    status: 200,
    description: "Access token successfully refreshed",
  })
  @ApiResponse({ status: 401, description: "Refresh token missing or expired" })
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
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth",
    });
    return { user: data.user, accessToken: data.accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Log out user and clear refresh cookie" })
  @ApiResponse({ status: 200, description: "User successfully logged out" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async logout(
    @CurrentUser("userId") userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.logout(userId);
    res.clearCookie("refreshToken", { path: "/api/v1/auth" });
    return data;
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current authenticated user profile" })
  @ApiResponse({ status: 200, description: "Profile retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async profile(@CurrentUser() user: any) {
    const data = await this.authService.getProfile(user.userId);
    return data;
  }

  // TODO: forgot/reset password
}
