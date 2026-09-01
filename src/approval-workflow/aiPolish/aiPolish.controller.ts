import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { AiPolishService, PolishResult  } from './aiPolish.service';
import { AwsAuthGuard } from '../common/aws-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AwsUser } from '../common/aws-auth.guard';
import { PolishRequestDto } from '../dto/ai-polish.dto';

@Controller('aws/v1/ai')
@UseGuards(AwsAuthGuard)
export class AiPolishController {
    private readonly logger = new Logger(AiPolishController.name);

    constructor(private readonly aiPolishService: AiPolishService) {}
    
    /**
     * AI 润色接口：前端「润色」按钮点击后调用
     */
    @Post('polish')
    async polish(@CurrentUser() user: AwsUser, @Body() dto: PolishRequestDto): Promise<PolishResult> {
        this.logger.log('body:', dto);
        return this.aiPolishService.polishContent(dto);
    }

}
