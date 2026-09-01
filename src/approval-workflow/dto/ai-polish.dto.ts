import { IsString } from 'class-validator';

/** 文本润色（POST /aws/v1/ai/polish） */
export interface PolishRequestDto {
  /** 申请类型 */
  type: string;
  /** 待润色的申请内容 */
  content: string;
}
