import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * 登录入参（C 决策：验 auth_db 后签 JWT）。
 * 密码为明文（与 auth_db sysUser.password 明文对比一致），由前端登录页提交。
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

/** 登录响应（包在统一响应 data 内） */
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    employeeId: string;
    name: string;
    title: string;
    role: string;
    department: string;
    managerId: string | null;
  };
}
