import { Module } from '@nestjs/common';
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from '@nestjs/jwt';

import { AwsAuthService } from './auth/aws-auth.service';
import { AuthController } from './auth/auth.controller';
import { UserService } from './users/user.service';
import { UserController } from './users/user.controller';
import { RequestService } from './requests/request.service';
import { TravelRequestController } from './requests/travel-request.controller';
import { LeaveRequestController } from './requests/leave-request.controller';
import { RequestController } from './requests/request.controller';
import { ReportController } from './requests/report.controller';
import { AiPolishController } from './aiPolish/aiPolish.controller';
import { AiPolishService } from './aiPolish/aiPolish.service';

/**
 * approval-workflow 产品模块（流程/审批端）
 * 以 `aws` 前缀对外（前缀写在各 Controller 上）。真实审批领域（用户/申请单/报表）在此实现。
 *
 * 用户组织数据（role / managerId / department）存放于本库 User 表（D2 决策）；
 * 登录鉴权复用 auth_db 的 SysUser 校验（见 AwsAuthService）。
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ws-design-jwt-secret-key-2026',
      signOptions: { expiresIn: '24h' },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [
    AuthController,
    UserController,
    TravelRequestController,
    LeaveRequestController,
    RequestController,
    ReportController,
    AiPolishController,
  ],
  providers: [AwsAuthService, UserService, RequestService, AiPolishService],
})
export class ApprovalWorkflowProductModule {}
