import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PolishRequestDto } from '../dto/ai-polish.dto';

export interface PolishInput {
  /** 申请类型，如 leave / reimbursement / purchase */
  type: string;
  /** 原始申请文本 */
  content: string;
}

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

    // ConfigService 是 NestJS 的配置管理服务，用于读取环境变量和配置文件：例如.env
    // 在对应模块的 module.ts 中确保 ConfigModule 已导入
    // 只在服务实例化时执行一次
    constructor(private readonly configService: ConfigService) {
        // 初始化
        // 读取配置参数
        this.enabled = this.configService.get("AI_POLISH_ENABLED") === "true";
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

            要求：
                1. 保持原意不变，不添加虚构信息；
                2. 语言正式、简洁、专业；
                3. 结构清晰，可分点说明；
                4. 直接输出润色后的文本，不要任何前缀或解释。

            示例：
                原始内容：我下周想请三天假，家里有点事。
                润色结果：尊敬的领导：因家中临时有重要事务需要处理，本人计划于下周申请事假三天，期间工作已提前做好安排，恳请领导批准。

            申请类型：{type}
            原始内容：{content}
        `);
    }

    /**
     * 润色审批申请文本
     */
    async polish(input: PolishInput): Promise<PolishResult> {
        this.logger.log('input:', input);

        if (!this.enabled) {
            return { polished: input.content, success: true };
        }
        this.logger.log('this.model:', this.model);

        try {
            const chain = this.prompt.pipe(this.model).pipe(new StringOutputParser());

            const polished = await chain.invoke({
                type: input.type,
                content: input.content,
            }); // 可追加二次清洗

            return { polished: polished.trim(), success: true };
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
    async polishWithRetry(input: PolishInput, retries = 2): Promise<PolishResult> {
        for (let i = 0; i <= retries; i++) {
            const result = await this.polish(input);
            if (result.success) {
                return result;
            }
            this.logger.warn(`第 ${i + 1} 次润色失败，重试中...`);
        }
        return { polished: input.content, success: false, error: '重试多次仍失败' };
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
