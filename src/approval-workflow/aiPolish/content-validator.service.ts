import { Injectable, Logger } from "@nestjs/common";
import { ContentQualityResultDto, PolishInputDto } from '../dto/ai-polish.dto';

@Injectable()
export class ContentValidatorService {
    private readonly logger = new Logger(ContentValidatorService.name);

    /**
     * 验证内容质量
     */
    validateContentQuality(content: string): ContentQualityResultDto {
        const trimmed = content?.trim() || '';
        let score = 0;
        const suggestions: string[] = [];
        const details = {
            hasChinese: false,
            hasEnglish: false,
            hasVerb: false,
            hasSubject: false,
            hasTime: false,
            length: trimmed.length,
            formalScore: 0,
        };

        // 1. 长度评分 (0-20分)
        if (trimmed.length < 5) {
            suggestions.push('内容太短，建议至少 5 个字符');
        } else if (trimmed.length < 10) {
            score += 10;
            suggestions.push('内容偏短，建议补充更多信息');
        } else if (trimmed.length >= 10 && trimmed.length <= 500) {
            score += 20;
        } else if (trimmed.length > 500) {
            score += 15;
            suggestions.push('内容过长，建议精简');
        }

        // 2. 中英文检测 (0-20分)
        const chineseCount = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
        const total = trimmed.length;

        details.hasChinese = chineseCount > 0;
        details.hasEnglish = englishCount > 0;

        if (chineseCount + englishCount === 0) {
            suggestions.push('没有检测到中文或英文字符，请输入有效文本');
        } else if ((chineseCount + englishCount) / total > 0.5) {
            score += 20;
        } else if ((chineseCount + englishCount) / total > 0.3) {
            score += 15;
        } else {
            score += 10;
            suggestions.push('包含过多特殊字符，建议使用中文或英文');
        }

        // 3. 语义完整性 (0-30分)
        const verbPattern = /(申请|请假|报销|采购|出差|加班|请求|需要|想要|希望|计划|安排|处理|办理|提交|审批|购买|预订|来访|接待|用车|用餐|会议|培训|招聘|调岗|离职|入职|转正|调薪|福利|津贴|补贴|报销|借款|还款|支付|收款|结算|对账|开票|盖章|用印|发文|报备|请示|报告|汇报|说明|介绍|展示|演示|测试|上线|部署|发布|变更|修复|优化|改进|完善|提升|增加|减少|调整|变更|取消|恢复|延期|提前|推迟|加快|放缓)/;
        const subjectPattern = /(我|我们|本人|部门|团队|公司|领导|经理|主管|老板|同事|员工|客户|供应商|合作伙伴|xx|某|本|该|其)/;
        const timePattern = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}月\d{1,2}日|今天|明天|后天|下周|下月|本周|本月|年|月|日|周|季度|半年|全年|上午|下午|晚上|工作日|休息日|节假日)/;

        details.hasVerb = verbPattern.test(trimmed);
        details.hasSubject = subjectPattern.test(trimmed);
        details.hasTime = timePattern.test(trimmed);

        if (details.hasVerb) score += 10;
        if (details.hasSubject) score += 10;
        if (details.hasTime) score += 10;

        if (!details.hasVerb) suggestions.push('缺少关键动词，如"申请"、"请假"等');
        if (!details.hasSubject) suggestions.push('缺少主语，建议明确申请主体');
        if (!details.hasTime) suggestions.push('建议明确时间信息');

        // 4. 格式规范 (0-15分)
        const hasPunctuation = /[，。！？、；：""''（）]/.test(trimmed);
        if (hasPunctuation) score += 15;

        // 5. 正式程度 (0-15分)
        const formalWords = [
            '尊敬的', '您好', '领导', '批准', '恳请', '特此', '根据', 
            '规定', '制度', '流程', '报请', '呈请', '请示', '汇报',
            '鉴于', '兹', '因此', '鉴于', '为了', '由于', '按照',
            '依据', '遵照', '参照', '根据', '经研究', '经决定'
        ];
        const formalCount = formalWords.filter(word => trimmed.includes(word)).length;
        details.formalScore = Math.min(formalCount * 3, 15);
        score += details.formalScore;

        // 6. 乱码检测（特殊字符过多）
        const specialChars = (trimmed.match(/[^a-zA-Z\u4e00-\u9fa5\s\d，。！？、；：""''（）]/g) || []).length;
        if (specialChars / total > 0.5) {
            suggestions.push('包含过多特殊字符，疑似乱码');
            score = Math.max(0, score - 20);
        }

        // 判断是否有效
        const isValid = score >= 50 && suggestions.length < 3;

        // 生成详细原因
        let reason = '';
        if (isValid) {
            reason = '内容质量良好';
        } else if (score < 30) {
            reason = '内容质量较差，请重新输入有效的申请文案';
        } else if (suggestions.length >= 3) {
            reason = '内容存在多个问题，请根据建议修改';
        } else {
            reason = suggestions.join('；') || '内容质量不足';
        }

        const result: ContentQualityResultDto = {
            score,
            isValid,
            reason,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
            details,
        };

        this.logger.log(`内容质量评分: ${score}/100, 有效: ${isValid}, 建议: ${suggestions.length}条`);
        
        return result;
    }

    /**
     * 快速检查：是否应该调用 AI
     */
    shouldCallAI(input: PolishInputDto): {
        shouldCall: boolean; 
        reason?: string;
        quality?: {
            score: number;
            isValid: boolean;
            suggestions?: string[];
        };
    } {
        if (!input.content || input.content.trim().length === 0) {
            return { shouldCall: false, reason: '内容为空' };
        }

        const result = this.validateContentQuality(input.content);
        
        if (!result.isValid) {
            return { 
                shouldCall: false, 
                reason: result.reason || '内容质量不足',
                quality: {
                    score: result.score,
                    isValid: result.isValid,
                    suggestions: result.suggestions,
                }, 
            };
        }

        // 如果内容已经是正式格式，可能不需要润色
        if (result.details?.formalScore && result.details.formalScore >= 10) {
            // 但是仍然可以润色，只是给出提示
            return { 
                shouldCall: true, 
                reason: '内容质量良好，可以进行润色' 
            };
        }

        return { shouldCall: true };
    }
}