import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AwsPrismaService } from '../../prisma/approval-workflow-prisma.service';
import { AwsUser } from '../common/aws-auth.guard';
import {
  RequestWithRelations,
  requestInclude,
  toRequestResponse,
} from '../common/request.mapper';
import { RequestResponse } from '../common/request.types';
import {
  CreateTravelRequestDto,
  TravelFieldsUpdateDto,
} from '../dto/travel-request.dto';
import {
  CreateLeaveRequestDto,
  LeaveFieldsUpdateDto,
} from '../dto/leave-request.dto';
import { QueryRequestsDto } from '../dto/query-request.dto';
import { ActionDto, RejectActionDto } from '../dto/action.dto';
import { BatchActionDto } from '../dto/batch-action.dto';
import {
  DashboardQueryDto,
  DashboardResponse,
} from '../dto/dashboard.dto';
import { MetaResponse } from '../dto/meta.dto';
import { COMMENT_MAX, PENDING_STATUSES } from '../dto/enums';

type ActorRole = 'applicant' | 'manager' | 'finance';

interface TransitionRule {
  from: string;
  to: string;
  actor: ActorRole;
  commentRequired: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  submit: '提交申请',
  approve: '通过',
  reject: '驳回',
  cancel: '撤销',
  reedit: '重新编辑',
};

/** 状态机（与前端 domain/workflow.ts 的 TRANSITIONS 对齐） */
const TRANSITIONS: Record<string, TransitionRule[]> = {
  submit: [{ from: 'draft', to: 'pending_manager', actor: 'applicant', commentRequired: false }],
  approve: [
    { from: 'pending_manager', to: 'pending_finance', actor: 'manager', commentRequired: false },
    { from: 'pending_finance', to: 'approved', actor: 'finance', commentRequired: false },
  ],
  reject: [
    { from: 'pending_manager', to: 'rejected', actor: 'manager', commentRequired: true },
    { from: 'pending_finance', to: 'rejected', actor: 'finance', commentRequired: true },
  ],
  cancel: [
    { from: 'pending_manager', to: 'cancelled', actor: 'applicant', commentRequired: false },
    { from: 'pending_finance', to: 'cancelled', actor: 'applicant', commentRequired: false },
  ],
  reedit: [
    { from: 'rejected', to: 'draft', actor: 'applicant', commentRequired: false },
    { from: 'draft', to: 'draft', actor: 'applicant', commentRequired: false },
  ],
};

@Injectable()
export class RequestService {
  private readonly logger = new Logger(RequestService.name);
  constructor(private readonly prisma: AwsPrismaService) {}

  // ---------- 单号生成 ----------
  private async genId(type: 'travel' | 'leave'): Promise<string> {
    const prefix = type === 'travel' ? 'TR' : 'LV';
    const rows = await this.prisma.request.findMany({
      where: { id: { startsWith: `${prefix}-` } },
      select: { id: true },
    });
    let max = 0;
    for (const r of rows) {
      const n = Number(r.id.slice(prefix.length + 1));
      if (Number.isFinite(n) && n > max) max = n;
    }
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }

  // ---------- 创建 ----------
  async createTravel(
    user: AwsUser,
    dto: CreateTravelRequestDto,
  ): Promise<RequestResponse> {
    const id = await this.genId('travel');
    const f = dto.fields;
    const created = await this.prisma.request.create({
      data: {
        id,
        type: 'travel',
        applicantId: user.id,
        applicantName: user.name,
        department: user.department,
        status: 'draft',
        reason: f.reason,
        urgency: f.urgency,
        note: f.budgetNote ?? null,
        legs: {
          create: f.legs.map((l) => ({
            from: l.from,
            to: l.to,
            departDate: l.departDate,
            returnDate: l.returnDate,
            transport: l.transport,
          })),
        },
        budget: {
          create: {
            transport: f.budget.transport,
            hotel: f.budget.hotel,
            allowance: f.budget.allowance,
            other: f.budget.other,
          },
        },
      },
      include: requestInclude,
    });
    return toRequestResponse(created);
  }

  async createLeave(
    user: AwsUser,
    dto: CreateLeaveRequestDto,
  ): Promise<RequestResponse> {
    const id = await this.genId('leave');
    const f = dto.fields;
    const created = await this.prisma.request.create({
      data: {
        id,
        type: 'leave',
        applicantId: user.id,
        applicantName: user.name,
        department: user.department,
        status: 'draft',
        reason: f.reason,
        leaveType: f.leaveType,
        leaveStart: f.leaveStart,
        leaveEnd: f.leaveEnd,
        note: f.note ?? null,
      },
      include: requestInclude,
    });
    return toRequestResponse(created);
  }

  // ---------- 详情 ----------
  async findOne(id: string, user?: AwsUser): Promise<RequestResponse> {
    const r = await this.prisma.request.findUnique({
      where: { id },
      include: { ...requestInclude, applicant: true },
    });
    if (!r) throw new NotFoundException('申请单不存在');
    if (user && !this.canView(user, r)) {
      throw new NotFoundException('申请单不存在');
    }
    return toRequestResponse(r);
  }

  // ---------- 编辑（仅 draft / rejected，仅本人） ----------
  async updateTravel(
    id: string,
    user: AwsUser,
    dto: { fields?: TravelFieldsUpdateDto },
  ): Promise<RequestResponse> {
    return this.update(id, user, dto.fields, 'travel');
  }

  async updateLeave(
    id: string,
    user: AwsUser,
    dto: { fields?: LeaveFieldsUpdateDto },
  ): Promise<RequestResponse> {
    return this.update(id, user, dto.fields, 'leave');
  }

  private async update(
    id: string,
    user: AwsUser,
    f: TravelFieldsUpdateDto | LeaveFieldsUpdateDto | undefined,
    type: 'travel' | 'leave',
  ): Promise<RequestResponse> {
    const req = await this.prisma.request.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!req) throw new NotFoundException('申请单不存在');
    if (req.type !== type) throw new BadRequestException('类型不匹配');
    if (!['draft', 'rejected'].includes(req.status)) {
      throw new BadRequestException('仅草稿或驳回单可编辑');
    }
    if (req.applicantId !== user.id) {
      throw new ForbiddenException('只能编辑自己的申请');
    }
    if (!f) return toRequestResponse(req);

    await this.prisma.$transaction(async (tx: any) => {
      const data: Record<string, unknown> = {};
      if ((f as any).reason !== undefined) data.reason = (f as any).reason;
      if ((f as any).urgency !== undefined) data.urgency = (f as any).urgency;
      if ((f as any).leaveType !== undefined) data.leaveType = (f as any).leaveType;
      if ((f as any).leaveStart !== undefined) data.leaveStart = (f as any).leaveStart;
      if ((f as any).leaveEnd !== undefined) data.leaveEnd = (f as any).leaveEnd;
      if ((f as any).budgetNote !== undefined) data.note = (f as any).budgetNote;
      if ((f as any).note !== undefined) data.note = (f as any).note;
      if (Object.keys(data).length) {
        await tx.request.update({ where: { id }, data });
      }
      if ((f as any).legs !== undefined) {
        await tx.tripLeg.deleteMany({ where: { requestId: id } });
        await tx.tripLeg.createMany({
          data: (f as any).legs.map((l: any) => ({
            requestId: id,
            from: l.from,
            to: l.to,
            departDate: l.departDate,
            returnDate: l.returnDate,
            transport: l.transport,
          })),
        });
      }
      if ((f as any).budget !== undefined) {
        const b = (f as any).budget;
        await tx.budget.upsert({
          where: { requestId: id },
          create: { requestId: id, ...b },
          update: { ...b },
        });
      }
    });
    return this.findOne(id);
  }

  // ---------- 删除（仅 draft，仅本人） ----------
  async remove(id: string, user: AwsUser): Promise<{ id: string }> {
    const req = await this.prisma.request.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('申请单不存在');
    if (req.status !== 'draft') {
      throw new BadRequestException('仅草稿可删除');
    }
    if (req.applicantId !== user.id) {
      throw new ForbiddenException('只能删除自己的申请');
    }
    await this.prisma.request.delete({ where: { id } });
    return { id };
  }

  // ---------- RPC 状态流转 ----------
  async submit(id: string, user: AwsUser, dto: ActionDto) {
    return this.applyTransition(id, user, 'submit', dto.comment);
  }
  async approve(id: string, user: AwsUser, dto: ActionDto) {
    return this.applyTransition(id, user, 'approve', dto.comment);
  }
  async reject(id: string, user: AwsUser, dto: RejectActionDto) {
    return this.applyTransition(id, user, 'reject', dto.comment);
  }
  async cancel(id: string, user: AwsUser, dto: ActionDto) {
    return this.applyTransition(id, user, 'cancel', dto.comment);
  }
  async reedit(id: string, user: AwsUser, dto: ActionDto) {
    return this.applyTransition(id, user, 'reedit', dto.comment);
  }

  /** 判断当前用户是否具备执行某条流转规则的资格（对齐前端 canActAs） */
  private canActAs(
    actor: ActorRole,
    user: AwsUser,
    applicantId: string,
  ): boolean {
    if (actor === 'applicant') return user.id === applicantId;
    if (actor === 'manager') {
      return user.role === 'manager' && user.id !== applicantId;
    }
    if (actor === 'finance') {
      return user.role === 'finance' && user.id !== applicantId;
    }
    return false;
  }

  private async applyTransition(
    id: string,
    user: AwsUser,
    action: string,
    comment?: string,
  ): Promise<RequestResponse> {
    const req = await this.prisma.request.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!req) throw new NotFoundException('申请单不存在');

    const candidates = TRANSITIONS[action] || [];
    const byStatus = candidates.filter((r) => r.from === req.status);
    if (byStatus.length === 0) {
      throw new BadRequestException(
        `「${req.status}」状态下无法${ACTION_LABELS[action] ?? action}`,
      );
    }
    const rule = byStatus.find((r) => this.canActAs(r.actor, user, req.applicantId));
    if (!rule) {
      const selfApproval = user.id === req.applicantId && action !== 'cancel';
      throw new ForbiddenException(
        selfApproval
          ? '不能审批自己提交的申请'
          : `你没有权限${ACTION_LABELS[action] ?? action}此申请`,
      );
    }

    const trimmed = comment?.trim();
    if (rule.commentRequired && !trimmed) {
      throw new BadRequestException(
        `${ACTION_LABELS[action] ?? action}时必须填写意见`,
      );
    }
    if (rule.commentRequired && trimmed && trimmed.length > COMMENT_MAX) {
      throw new BadRequestException(`意见不能超过 ${COMMENT_MAX} 字`);
    }

    // draft→draft 的 reedit：仅继续编辑，不写审计、状态不变
    if (action === 'reedit' && req.status === 'draft') {
      return toRequestResponse(req);
    }

    const now = new Date();
    const updated = await this.prisma.request.update({
      where: { id },
      data: {
        status: rule.to,
        submittedAt: action === 'submit' ? now : req.submittedAt,
        audit: {
          create: {
            at: now,
            actorId: user.id,
            actorName: user.name,
            action,
            from: req.status,
            to: rule.to,
            comment: trimmed || null,
          },
        },
      },
      include: requestInclude,
    });
    return toRequestResponse(updated);
  }

  // ---------- 列表 / scope ----------
  async queryRequests(
    user: AwsUser,
    query: QueryRequestsDto,
    type?: 'travel' | 'leave',
  ): Promise<RequestResponse[]> {
    const where: Record<string, unknown> = {};
    if (type) where.type = type;

    if (query.status && query.status !== 'all') {
      where.status =
        query.status === 'pending' ? { in: PENDING_STATUSES } : query.status;
    }
    if (query.applicantId) where.applicantId = query.applicantId;
    if (query.department) where.department = query.department;

    if (query.keyword) {
      where.OR = [
        { reason: { contains: query.keyword } },
        {
          legs: {
            some: {
              OR: [
                { from: { contains: query.keyword } },
                { to: { contains: query.keyword } },
              ],
            },
          },
        },
      ];
    }

    if (query.year) {
      const y = query.year;
      const start = new Date(y, 0, 1);
      const end = new Date(y + 1, 0, 1);
      if (query.month) {
        where.createdAt = {
          gte: new Date(y, query.month - 1, 1),
          lt: new Date(y, query.month, 1),
        };
      } else {
        where.createdAt = { gte: start, lt: end };
      }
    }

    if (query.scope === 'mine') {
      where.applicantId = user.id;
    } else if (query.scope === 'todo') {
      if (user.role === 'manager') {
        where.status = 'pending_manager';
        where.applicant = { managerId: user.id };
      } else if (user.role === 'finance') {
        where.status = 'pending_finance';
      } else {
        where.id = '__never__';
      }
    }

    const orderBy =
      query.sort === 'submitted'
        ? [{ submittedAt: 'desc' as const }]
        : [{ updatedAt: 'desc' as const }];

    const rows = await this.prisma.request.findMany({
      where,
      include: { ...requestInclude, applicant: true },
      orderBy,
    });

    const visible =
      query.scope === 'mine' || query.scope === 'todo'
        ? rows
        : rows.filter((r) => this.canView(user, r));

    return visible.map((r) =>
      toRequestResponse(r as unknown as RequestWithRelations),
    );
  }

  /** 可见性（对齐前端 canViewRequest） */
  private canView(user: AwsUser, r: any): boolean {
    if (r.applicantId === user.id) return true;
    if (user.role === 'manager') {
      return r.applicant?.role === 'employee' && r.status !== 'draft';
    }
    if (user.role === 'finance') {
      return r.status === 'pending_finance';
    }
    return false;
  }

  // ---------- 批量 ----------
  async batch(user: AwsUser, dto: BatchActionDto) {
    if (dto.action === 'reject' && !dto.comment?.trim()) {
      throw new BadRequestException('驳回时必须填写意见');
    }
    const success: string[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const id of dto.ids) {
      try {
        await this.applyTransition(id, user, dto.action, dto.comment);
        success.push(id);
      } catch (e: any) {
        failed.push({ id, reason: e?.message ?? '处理失败' });
      }
    }
    return { success, failed };
  }

  // ---------- 报表 ----------
  /**
   * 看板聚合。口径与前端统计报表表格（deptRequests）对齐：
   * - 仅统计「当前用户所在部门」（前端按 identity.user.department 过滤）；
   * - 排除本人发起的单据（前端 deptRequests 排除 applicantId === self）；
   * - 排除草稿（前端 deptRequests 排除 status === 'draft'）。
   * 这样看板的概览卡/图表与下方申请记录表在数据范围上保持一致。
   * type/year/month 仍作为附加维度由 query 控制。
   */
  async dashboard(
    query: DashboardQueryDto,
    user: AwsUser,
  ): Promise<DashboardResponse> {
    const where: Record<string, unknown> = {};
    if (query.type) where.type = query.type;
    // 部门范围：优先用显式 query.department，否则回落到当前用户所在部门
    where.department = query.department ?? user.department;
    // 排除本人 + 排除草稿，与前端 deptRequests 对齐
    where.applicantId = { not: user.id };
    where.status = { not: 'draft' };
    if (query.year) {
      const y = query.year;
      if (query.month) {
        where.createdAt = {
          gte: new Date(y, query.month - 1, 1),
          lt: new Date(y, query.month, 1),
        };
      } else {
        where.createdAt = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
      }
    }

    const rows = await this.prisma.request.findMany({
      where,
      include: { budget: true },
    });

    const statusCounts: Record<string, number> = {};
    const monthCounts: Record<string, number> = {};
    let budgetCents = 0;
    let leaveDays = 0;
    for (const r of rows) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
      const ym = `${r.createdAt.getFullYear()}-${String(
        r.createdAt.getMonth() + 1,
      ).padStart(2, '0')}`;
      monthCounts[ym] = (monthCounts[ym] ?? 0) + 1;
      if (r.type === 'travel' && r.budget) {
        budgetCents +=
          Number(r.budget.transport) +
          Number(r.budget.hotel) +
          Number(r.budget.allowance) +
          Number(r.budget.other);
      }
      if (r.type === 'leave' && r.leaveStart && r.leaveEnd) {
        const days =
          Math.round(
            (Date.parse(r.leaveEnd) - Date.parse(r.leaveStart)) / 86_400_000,
          ) + 1;
        if (days > 0) leaveDays += days;
      }
    }

    const statusDistribution = Object.entries(statusCounts).map(
      ([name, value]) => ({ name, value }),
    );
    const monthlyTrend = Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, value, unit: '单' }));

    let leaveTypeDistribution: { name: string; value: number }[] | undefined;
    if (!query.type || query.type === 'leave') {
      const lt: Record<string, number> = {};
      for (const r of rows) {
        if (r.type === 'leave' && r.leaveType) {
          lt[r.leaveType] = (lt[r.leaveType] ?? 0) + 1;
        }
      }
      leaveTypeDistribution = Object.entries(lt).map(([name, value]) => ({
        name,
        value,
      }));
    }

    return {
      statusDistribution,
      monthlyTrend,
      totals: {
        count: rows.length,
        budgetCents,
        leaveDays,
      },
      leaveTypeDistribution,
    };
  }

  // ---------- 元数据 ----------
  async meta(type: 'travel' | 'leave'): Promise<MetaResponse> {
    if (type === 'leave') {
      return {
        type: 'leave',
        maxLegs: 0,
        centsMax: 0,
        fields: [
          { key: 'reason', type: 'textarea', required: true, min: 5, max: 200 },
          {
            key: 'leaveType',
            type: 'select',
            required: true,
            options: [
              { value: 'annual', label: '年假' },
              { value: 'sick', label: '病假' },
              { value: 'personal', label: '事假' },
            ],
          },
          { key: 'leaveRange', type: 'dateRange', required: true },
          { key: 'note', type: 'textarea', required: false, max: 200 },
        ],
      };
    }
    return {
      type: 'travel',
      maxLegs: 10,
      centsMax: 1_000_000_000,
      fields: [
        { key: 'reason', type: 'textarea', required: true, min: 10, max: 200 },
        {
          key: 'urgency',
          type: 'select',
          required: true,
          options: [
            { value: 'normal', label: '普通' },
            { value: 'urgent', label: '紧急' },
          ],
        },
        { key: 'legs', type: 'repeatable', required: true, min: 1, max: 10 },
        {
          key: 'budget',
          type: 'group',
          required: true,
          noteThresholdCents: 1_000_000,
        },
      ],
    };
  }
}
