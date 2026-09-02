import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PolishRequestDto, PolishInputDto } from '../dto/ai-polish.dto';
import { ContentValidatorService } from './content-validator.service';

export interface PolishResult {
  /** 润色后的文本 */
  polished: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
}

@Injectable()
export class AiPolishService {
    private readonly logger = new Logger(AiPolishService.name);
    private readonly model: ChatOpenAI;
    private readonly prompt: PromptTemplate;
    private readonly enabled: boolean;
    private readonly maxRetries: number;
    
    // 申请类型对应的提示词
    private readonly typePrompts: Record<string, string> = {
        leave: '请假申请，语气诚恳，说明请假原因与工作交接安排。',
        reimbursement: '报销申请，列明费用明细、金额与事由，格式规范。',
        purchase: '采购申请，说明采购必要性、预算与预期收益。',
        travel: '出差申请，说明出差目的、行程安排与预算。',
        overtime: '加班申请，说明加班原因与工作时长。',
    };

    // ConfigService 是 NestJS 的配置管理服务，用于读取环境变量和配置文件：例如.env
    // 在对应模块的 module.ts 中确保 ConfigModule 已导入
    // 只在服务实例化时执行一次
    constructor(
        private readonly configService: ConfigService,
        private readonly contentValidator: ContentValidatorService

    ) {
        // 初始化
        // 读取配置参数
        this.enabled = this.configService.get("AI_POLISH_ENABLED") === "true";
        this.maxRetries = this.configService.get("AI_POLISH_MAX_RETRIES") ?? 2;
        // 获取process.env.OPENAI_ALIYUN_API_KEY
        const apiKey = this.configService.get('OPENAI_ALIYUN_API_KEY');
        const baseURL = this.configService.get('OPENAI_ALIYUN_BASE_URL');
        const model = this.configService.get("OPENAI_MODEL") ?? "gpt-4o-mini";
        if (!apiKey || apiKey === 'your-api-key-here') {
            this.logger.error('OPENAI_API_KEY 未正确配置');
        }

        // 初始化模型
        this.model = new ChatOpenAI({
            apiKey,
            configuration: {
                baseURL
            },
            model,
            temperature: 0.3,
        });
        this.logger.log('✅ AI 模型初始化成功');
        this.logger.log(`模型配置: ${JSON.stringify({
            apiKey,
            configuration: {
                baseURL
            },
            model
        })}`);
        this.logger.log('model:', this.model);

        // 定义润色提示词模板
        this.prompt = PromptTemplate.fromTemplate(`
            你是一位专业的行政助理，擅长撰写规范的审批申请文本。
            请根据以下申请类型和原始内容，润色成一段正式、清晰、逻辑通顺的申请说明。

            当前申请类型：{type}
            类型特定要求：{typeInstruction}
           
            重要规则：
                1. 如果用户输入的内容是乱码、无意义字符、或者明显不是正常的申请文案，请直接返回原始内容，并说明"内容无效，请重新输入有效的申请文案"。
                2. 不要尝试"润色"乱码或无意义的内容。
                3. 只有当用户输入的是正常的、有语义的中文或英文文本时，才进行润色。
                4. 润色后的文本必须保持原意，不添加虚构信息。
                5. 直接输出结果，不要任何前缀或解释。

            示例：
                原始内容：我下周想请三天假，家里有点事。
                润色结果：尊敬的领导：因家中临时有重要事务需要处理，本人计划于下周申请事假三天，期间工作已提前做好安排，恳请领导批准。

            申请类型：{type}
            原始内容：{content}

            
        `);
    }

    /**
     * 获取类型指令
     */
    private getTypeInstruction(type: string): string {
        return this.typePrompts[type] ?? '通用申请，正式简洁。';
    }

    /**
     * 润色审批申请文本
     */
    async polish(input: PolishInputDto): Promise<PolishResult> {
        // this.logger.log('input:', input);
        if (!this.enabled) {
            return { polished: input.content, success: false, error: 'AI 润色功能未启用' };
        }
        this.logger.log('this.model:', JSON.stringify(this.model, null, 2));

        // 预检查是否需要调用AI
        const check = this.contentValidator.shouldCallAI(input);
        this.logger.log(`内容质量：${JSON.stringify(check.quality)}`)
        if (!check.shouldCall) {
            this.logger.log(`跳过 AI 调用: ${check.reason}`);
            return {
                polished: input.content,
                success: false,
                error: check.reason || '内容无需润色',
                // quality: check.quality,
            };
        }

        try {
            // 在调用时动态生成类型指令
            const typeInstruction = this.getTypeInstruction(input.type);
            const chain = this.prompt.pipe(this.model).pipe(new StringOutputParser());

            const polished = await chain.invoke({
                type: input.type,
                content: input.content,
                typeInstruction: typeInstruction,
            }); // 可追加二次清洗

            this.logger.log('propmts模版以及润色后文本: ', {
                type: input.type,
                content: input.content,
                typeInstruction: typeInstruction,
                polished: polished
            });

            // 如果返回的结果是"内容无效，请重新输入有效的申请文案"，则返回失败
            if (polished.trim().indexOf('内容无效，请重新输入有效的申请文案') !== -1) {
                return { polished: polished.trim(), success: false, error: '内容无效，请重新输入有效的申请文案' };
            } else {
                return { polished: polished.trim(), success: true };
            }
        } catch (error) {
            const err = error as Error;
            this.logger.error(`AI 润色失败: ${err.message}`, err.stack);
            // 失败时回退到原始文本，不影响主流程
            return {
                polished: input.content,
                success: false,
                error: '大模型调用失败',
            };
        }
    }

    // 重试与降级
    async polishWithRetry(input: PolishInputDto, retries: number = this.maxRetries ?? 2): Promise<PolishResult> {
        let err: string | undefined = undefined;
        for (let i = 0; i <= retries; i++) {
            const result = await this.polish(input);
            // 不重试
            if (result.success || result.error.includes('内容无效') || result.error.includes('建议修改')) {
                return result;
            }
            this.logger.warn(`第 ${i + 1} 次润色失败，重试中...`);
            this.logger.log(`${JSON.stringify(result)} ${err}`)

            // 如果不是最后一次，延迟
            if (i < retries) {
                await this.sleep(1000 * (i + 1));
            }
        }
        
        return { polished: input.content, success: false, error: err || '重试多次仍失败' };
    }

    // 添加 sleep 方法
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    /**
     * 润色申请内容（由前端「AI 润色」按钮触发）
     * 只返回润色结果，不落库、不创建申请
    */ 
    async polishContent(dto: PolishRequestDto): Promise<PolishResult> {
        return this.polishWithRetry({
            type: dto.type,
            content: dto.content,
        });
    }
}
