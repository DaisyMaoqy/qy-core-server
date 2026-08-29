import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequestService } from './request.service';
import { AwsAuthGuard } from '../common/aws-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AwsUser } from '../common/aws-auth.guard';
import { DashboardQueryDto } from '../dto/dashboard.dto';

@Controller('aws/v1/reports')
@UseGuards(AwsAuthGuard)
export class ReportController {
  constructor(private readonly requestService: RequestService) {}

  /**
   * GET /aws/v1/reports/dashboard
   * 看板按「当前登录用户所在部门」聚合，并与前端统计报表表格（deptRequests：
   * 同部门 + 排除本人 + 排除草稿）对齐口径，避免看板全公司、表格仅本部门的不一致。
   */
  @Get('dashboard')
  dashboard(@CurrentUser() user: AwsUser, @Query() q: DashboardQueryDto) {
    return this.requestService.dashboard(q, user);
  }
}
