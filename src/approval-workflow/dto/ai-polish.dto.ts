import { 
  IsString, 
  IsNotEmpty, 
  MinLength, 
  MaxLength,
  IsInt,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  Min, 
  Max
} from 'class-validator';
import { Type } from 'class-transformer';

/** 文本润色（POST /aws/v1/ai/polish）
 * 用于接收前端传来的数据 
 * 严格校验 
*/
export class PolishRequestDto {
  /** 申请类型 */
  @IsString({ message: '申请类型必须是字符串' })
  @IsNotEmpty({ message: '申请类型不能为空' })
  type: string;
  /** 待润色的申请内容 */
  @IsString({ message: '内容必须是字符串' })
  @IsNotEmpty({ message: '内容不能为空' })
  @MinLength(1, { message: '内容不能为空' })
  @MaxLength(200, { message: '内容不能超过 200 个字符' })
  content: string;
}

/** 需要润色处理的文本输入
 * 内部使用的 DTO 
 * 用于服务层传递数据
 *  */
export class PolishInputDto {
  /** 申请类型，如 leave / travel */
  @IsString()
  @IsNotEmpty()
  type: string;
  /** 原始申请文本 */
  @IsString()
  @IsNotEmpty()
  content: string;
}

/**
 * 内容质量详细
 */
export class ContentQualityDetailsDto {
  @IsBoolean()
  hasChinese: boolean;

  @IsBoolean()
  hasEnglish: boolean;

  @IsBoolean()
  hasVerb: boolean;

  @IsBoolean()
  hasSubject: boolean;

  @IsBoolean()
  hasTime: boolean;

  @IsInt()
  @Min(0)
  length: number;

  @IsInt()
  @Min(0)
  @Max(15)
  formalScore: number;
}

/**
 * 内容检验字段
 * 用于返回给前端
 */
export class ContentQualityResultDto {
    @IsInt()
    @Min(0)
    @Max(100)
    score: number; // 0-100

    @IsBoolean()
    isValid: boolean;

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    suggestions?: string[];

    @IsOptional()
    @IsObject()
    @Type(() => ContentQualityDetailsDto)
    details?: ContentQualityDetailsDto;
}
