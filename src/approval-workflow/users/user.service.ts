import { Injectable, NotFoundException } from '@nestjs/common';
import { AwsPrismaService } from '../../prisma/approval-workflow-prisma.service';
import { AwsUser } from '../common/aws-auth.guard';
import {
  requestInclude,
  toRequestResponse,
} from '../common/request.mapper';
import { RequestResponse } from '../common/request.types';

@Injectable()
export class UserService {
  constructor(private readonly prisma: AwsPrismaService) {}

  /** 当前登录用户：以 JWT 中的 id 回查库，补齐 employeeId / title 等字段 */
  async getMe(user: AwsUser) {
    const full = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!full) {
      // 极端兜底：JWT 有效但库中无对应用户，至少返回 JWT 内字段
      return {
        id: user.id,
        name: user.name,
        role: user.role,
        department: user.department,
        managerId: user.managerId,
      };
    }
    return {
      id: full.id,
      employeeId: full.employeeId,
      name: full.name,
      title: full.title ?? '',
      role: full.role,
      department: full.department,
      managerId: full.managerId,
    };
  }

  async listUsers(department?: string, role?: string) {
    return this.prisma.user.findMany({
      where: {
        department: department ?? undefined,
        role: role ?? undefined,
      },
      orderBy: { employeeId: 'asc' },
    });
  }

  async getUser(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('用户不存在');
    return u;
  }

  async getUserRequests(id: string): Promise<RequestResponse[]> {
    const rows = await this.prisma.request.findMany({
      where: { applicantId: id },
      include: requestInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toRequestResponse);
  }
}
