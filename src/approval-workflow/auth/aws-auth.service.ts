import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthPrismaService } from '../../prisma/auth-prisma.service';
import { AwsPrismaService } from '../../prisma/approval-workflow-prisma.service';
import { LoginDto, LoginResponse } from '../dto/login.dto';
import { AwsUser } from '../common/aws-auth.guard';

@Injectable()
export class AwsAuthService {
  private readonly logger = new Logger(AwsAuthService.name);

  constructor(
    private readonly authPrisma: AuthPrismaService, // auth_db
    private readonly awsPrisma: AwsPrismaService, // approval_workflow_db
    private readonly jwtService: JwtService,
  ) {}

  /**
   * C 决策：验 auth_db 的 sysUser（userId + 明文密码），再映射到 aws User（按 employeeId），
   * 签 JWT。aws User 缺失时按默认（employee）自动开通，保证任意 auth_db 账号可登录。
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const sysUser = await this.authPrisma.sysUser.findUnique({
      where: { userId: dto.userId },
    });
    if (!sysUser || sysUser.password !== dto.password) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const awsUser = await this.resolveAwsUser(sysUser.userId, sysUser);

    const payload: AwsUser = {
      id: awsUser.id,
      userId: awsUser.employeeId,
      name: awsUser.name,
      role: awsUser.role,
      department: awsUser.department,
      managerId: awsUser.managerId,
      employeeId: awsUser.employeeId,
      title: awsUser.title,
      tenantId: dto.tenantId,
    };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: awsUser.id,
        employeeId: awsUser.employeeId,
        name: awsUser.name,
        title: awsUser.title ?? '',
        role: awsUser.role,
        department: awsUser.department,
        managerId: awsUser.managerId,
      },
    };
  }

  /** 按 employeeId 取 aws 用户，缺失则自动开通（默认 employee） */
  private async resolveAwsUser(
    employeeId: string,
    sysUser: { regName?: string | null; companyName?: string | null },
  ) {
    const existing = await this.awsPrisma.user.findUnique({
      where: { employeeId },
    });
    if (existing) return existing;

    this.logger.log(`为 ${employeeId} 自动开通审批工作流用户`);
    return this.awsPrisma.user.create({
      data: {
        employeeId,
        name: employeeId,
        department: sysUser.regName || sysUser.companyName || '未分配',
        role: 'employee',
      },
    });
  }
}
