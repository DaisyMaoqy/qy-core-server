import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { convertDatesToBeijing } from '../time';

/**
 * 全局时间拦截器：递归把响应报文里的所有 Date 实例转换成北京时间 ISO 字符串。
 * 配合「库内 DATETIME 按 UTC 存储」的约定，保证接口输出统一为 +08:00，
 * 后续任意模块新增返回 Date 字段都会自动生效，无需逐处 toISOString。
 */
@Injectable()
export class BeijingTimeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => convertDatesToBeijing(data)));
  }
}
