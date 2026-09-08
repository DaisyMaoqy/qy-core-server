import { Prisma } from '@prisma/approval-client';
import {
  AuditEntryResponse,
  RequestResponse,
  TravelFieldsResponse,
  LeaveFieldsResponse,
} from './request.types';
import { toBeijingISO } from '../../common/time';

/** 列表/详情统一使用的关联加载 */
export const requestInclude = {
  audit: { orderBy: { at: 'asc' } },
  legs: true,
  budget: true,
  // 申请人角色：供前端 canViewRequest 判断「主管/财务能否查看」。
  // 后端模式下申请人是后端 UUID，前端本地组织表查不到，必须随单返回。
  applicant: { select: { id: true, role: true } },
} satisfies Prisma.RequestInclude;

export type RequestWithRelations = Prisma.RequestGetPayload<{
  include: typeof requestInclude;
}>;

/** 将库内 Request（含 legs/budget/audit）映射为前端 Request 形状 */
export function toRequestResponse(r: RequestWithRelations): RequestResponse {
  const audit: AuditEntryResponse[] = r.audit.map((a) => ({
    id: a.id,
    at: toBeijingISO(a.at) ?? '',
    actorId: a.actorId,
    actorName: a.actorName,
    action: a.action,
    from: a.from,
    to: a.to,
    comment: a.comment ?? undefined,
  }));

  const fields: TravelFieldsResponse | LeaveFieldsResponse =
    r.type === 'travel'
      ? {
          reason: r.reason,
          urgency: r.urgency ?? 'normal',
          legs: r.legs.map((l) => ({
            id: l.id,
            from: l.from,
            to: l.to,
            departDate: l.departDate,
            returnDate: l.returnDate,
            transport: l.transport,
          })),
          budget: r.budget
            ? {
                transport: Number(r.budget.transport),
                hotel: Number(r.budget.hotel),
                allowance: Number(r.budget.allowance),
                other: Number(r.budget.other),
              }
            : { transport: 0, hotel: 0, allowance: 0, other: 0 },
          budgetNote: r.note ?? undefined,
        }
      : {
          reason: r.reason,
          leaveType: r.leaveType ?? 'annual',
          leaveStart: r.leaveStart ?? '',
          leaveEnd: r.leaveEnd ?? '',
          note: r.note ?? undefined,
        };

  return {
    id: r.id,
    type: r.type,
    applicantId: r.applicantId,
    applicantName: r.applicantName,
    applicantRole: r.applicant.role,
    department: r.department,
    status: r.status,
    createdAt: toBeijingISO(r.createdAt) ?? '',
    updatedAt: toBeijingISO(r.updatedAt) ?? '',
    submittedAt: toBeijingISO(r.submittedAt),
    audit,
    fields,
  };
}
