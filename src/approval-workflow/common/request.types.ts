/** 与前端 domain/types.ts 对齐的响应结构（前端不改，后端按此返回） */

export interface AuditEntryResponse {
  id: string;
  at: string; // ISO (+08:00)
  actorId: string;
  actorName: string;
  action: string;
  from: string;
  to: string;
  comment?: string;
}

export interface LegResponse {
  id: string;
  from: string;
  to: string;
  departDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  transport: string;
}

export interface BudgetResponse {
  transport: number; // 分
  hotel: number;
  allowance: number;
  other: number;
}

export interface TravelFieldsResponse {
  reason: string;
  urgency: string;
  legs: LegResponse[];
  budget: BudgetResponse;
  budgetNote?: string;
}

export interface LeaveFieldsResponse {
  reason: string;
  leaveType: string;
  leaveStart: string; // YYYY-MM-DD
  leaveEnd: string; // YYYY-MM-DD
  note?: string;
}

export interface RequestResponse {
  id: string;
  type: string; // travel | leave
  applicantId: string;
  applicantName: string;
  /** 申请人角色：前端 canViewRequest 判断主管/财务可见性用，后端 UUID 无法在本地组织表反查 */
  applicantRole: string;
  department: string;
  status: string;
  createdAt: string; // ISO (+08:00)
  updatedAt: string; // ISO (+08:00)
  submittedAt?: string; // ISO (+08:00)
  audit: AuditEntryResponse[];
  fields: TravelFieldsResponse | LeaveFieldsResponse;
}
