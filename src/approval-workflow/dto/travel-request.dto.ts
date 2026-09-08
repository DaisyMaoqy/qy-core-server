import {
  IsString,
  IsNotEmpty,
  Length,
  IsEnum,
  IsArray,
  ValidateNested,
  ValidateIf,
  IsInt,
  Min,
  Max,
  IsOptional,
  Matches,
  ArrayMinSize,
  ArrayMaxSize
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  URGENCIES,
  TRANSPORTS,
  DATE_REGEX,
  REASON_MIN_TRAVEL,
  REASON_MAX,
  MAX_LEGS,
  CENTS_MAX,
  BUDGET_NOTE_THRESHOLD_CENTS,
  NOTE_MAX,
} from './enums';

/** 行程单段 */
export class LegDto {
  @IsString() @IsNotEmpty() from: string;
  @IsString() @IsNotEmpty() to: string;
  @IsString() @Matches(DATE_REGEX, { message: 'departDate 格式应为 YYYY-MM-DD' })
  departDate: string;
  @IsString() @Matches(DATE_REGEX, { message: 'returnDate 格式应为 YYYY-MM-DD' })
  returnDate: string;
  @IsEnum(TRANSPORTS) transport: string;
}

/** 分项预算（对外「分」整数） */
export class BudgetAmountDto {
  @IsInt() @Min(0) @Max(CENTS_MAX) transport: number;
  @IsInt() @Min(0) @Max(CENTS_MAX) hotel: number;
  @IsInt() @Min(0) @Max(CENTS_MAX) allowance: number;
  @IsInt() @Min(0) @Max(CENTS_MAX) other: number;
}

/** 创建差旅：fields 包裹（E 决策，前端不改结构） */
export class TravelFieldsDto {
  @IsString() @Length(REASON_MIN_TRAVEL, REASON_MAX) reason: string;
  @IsEnum(URGENCIES) urgency: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegDto)
  @ArrayMinSize(1)        // ✅ 数组最少1个元素
  @ArrayMaxSize(MAX_LEGS) // ✅ 数组最多 MAX_LEGS 个元素
  legs: LegDto[];
  @ValidateNested() @Type(() => BudgetAmountDto) budget: BudgetAmountDto;
  // 预算合计 > 1,000,000 分（1 万元）时，budgetNote 必填
  @ValidateIf(
    (o: TravelFieldsDto) =>
      !!o.budget &&
      o.budget.transport +
        o.budget.hotel +
        o.budget.allowance +
        o.budget.other >
        BUDGET_NOTE_THRESHOLD_CENTS,
  )
  @IsString({ message: '预算合计超过 1 万元（1,000,000 分）时必须填写说明' })
  budgetNote: string;
}

/** 编辑差旅：所有字段可选 */
export class TravelFieldsUpdateDto {
  @IsOptional() @IsString() @Length(REASON_MIN_TRAVEL, REASON_MAX) reason?: string;
  @IsOptional() @IsEnum(URGENCIES) urgency?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegDto)
  @ArrayMinSize(1)        // ✅ 数组最少1个元素
  @ArrayMaxSize(MAX_LEGS) // ✅ 数组最多 MAX_LEGS 个元素
  legs?: LegDto[];
  @IsOptional() @ValidateNested() @Type(() => BudgetAmountDto) budget?: BudgetAmountDto;
  @IsOptional() @IsString() @Length(0, NOTE_MAX) budgetNote?: string;
}

export class CreateTravelRequestDto {
  @ValidateNested() @Type(() => TravelFieldsDto) fields: TravelFieldsDto;
}

export class UpdateTravelRequestDto {
  @IsOptional() @ValidateNested() @Type(() => TravelFieldsUpdateDto)
  fields?: TravelFieldsUpdateDto;
}
