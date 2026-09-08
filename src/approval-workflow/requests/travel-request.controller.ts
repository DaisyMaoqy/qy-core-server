import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { RequestService } from './request.service';
import { AwsAuthGuard } from '../common/aws-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AwsUser } from '../common/aws-auth.guard';
import { QueryRequestsDto } from '../dto/query-request.dto';
import {
  CreateTravelRequestDto,
  UpdateTravelRequestDto,
} from '../dto/travel-request.dto';
import { ActionDto, RejectActionDto } from '../dto/action.dto';

@Controller('aws/v1/travel-requests')
@UseGuards(AwsAuthGuard)
export class TravelRequestController {
  private readonly logger = new Logger(TravelRequestController.name);
  constructor(private readonly requestService: RequestService) {}

  /** GET /aws/v1/travel-requests（列表，支持 ?status/scope/keyword/...） */
  @Get()
  list(@CurrentUser() user: AwsUser, @Query() q: QueryRequestsDto) {
    return this.requestService.queryRequests(user, q, 'travel');
  }

  /** POST /aws/v1/travel-requests（新建差旅草稿） */
  @Post()
  create(@CurrentUser() user: AwsUser, @Body() dto: CreateTravelRequestDto) {
    return this.requestService.createTravel(user, dto);
  }

  /** GET /aws/v1/travel-requests/meta（校验规则，需在 :id 之前声明） */
  @Get('meta')
  meta() {
    return this.requestService.meta('travel');
  }

  /** GET /aws/v1/travel-requests/:id */
  @Get(':id')
  get(@CurrentUser() user: AwsUser, @Param('id') id: string) {
    return this.requestService.findOne(id, user);
  }

  /** PUT /aws/v1/travel-requests/:id（编辑草稿） */
  @Put(':id')
  update(
    @CurrentUser() user: AwsUser,
    @Param('id') id: string,
    @Body() dto: UpdateTravelRequestDto,
  ) {
    return this.requestService.updateTravel(id, user, dto);
  }

  /** DELETE /aws/v1/travel-requests/:id */
  @Delete(':id')
  remove(@CurrentUser() user: AwsUser, @Param('id') id: string) {
    return this.requestService.remove(id, user);
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() user: AwsUser,
    @Param('id') id: string,
    @Body() dto: ActionDto,
  ) {
    return this.requestService.submit(id, user, dto);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser() user: AwsUser,
    @Param('id') id: string,
    @Body() dto: ActionDto,
  ) {
    return this.requestService.approve(id, user, dto);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: AwsUser,
    @Param('id') id: string,
    @Body() dto: RejectActionDto,
  ) {
    return this.requestService.reject(id, user, dto);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AwsUser,
    @Param('id') id: string,
    @Body() dto: ActionDto,
  ) {
    return this.requestService.cancel(id, user, dto);
  }

  @Post(':id/reedit')
  reedit(
    @CurrentUser() user: AwsUser,
    @Param('id') id: string,
    @Body() dto: ActionDto,
  ) {
    return this.requestService.reedit(id, user, dto);
  }
}
