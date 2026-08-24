import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/** 当前登录用户（JWT payload，由 AwsAuthGuard 注入 request.user） */
export interface AwsUser {
  /** aws User.id（uuid） */
  id: string;
  /** 工号 employeeId */
  userId: string;
  name: string;
  role: string; // employee | manager | finance
  department: string;
  managerId: string | null;
  employeeId: string | null;
  title: string | null;
  tenantId?: string;
}

@Injectable()
export class AwsAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    if (!header || typeof header !== 'string') {
      throw new UnauthorizedException('缺少 Authorization 头');
    }
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authorization 格式应为 Bearer <token>');
    }
    try {
      const payload = this.jwtService.verify<AwsUser>(token);
      (req as unknown as { user: AwsUser }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('无效或已过期的 token');
    }
  }
}
