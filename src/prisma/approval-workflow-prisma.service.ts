import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient as AwsPrismaClient } from "@prisma/approval-client";

@Injectable()
export class AwsPrismaService
  extends AwsPrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AwsPrismaService.name);
  
  constructor() {
    super({
      // 配置日志级别
      log: process.env.NODE_ENV === 'production' ? 
        ['error', 'warn'] : 
        [
          { emit: 'event', level: 'query' },     // 打印 SQL 语句
          { emit: 'stdout', level: 'info' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ],
    });
  }
  async onModuleInit() {
    await this.$connect();
    // 钉死会话时区为 UTC：DATETIME 无时区，官方 mysql:8.0 镜像默认 UTC，
    // 但本地 MySQL 可能随系统时区为 +8；不钉会导致 dev/云存储与读取不一致。
    await this.$queryRawUnsafe(`SET time_zone = '+00:00'`);

    if (process.env.NODE_ENV !== 'production') {
      //  监听 query 事件，打印 SQL 执行时间
      this.$on('query' as never, (e: any) => {
        this.logger.debug('SQL:', e.query);
        this.logger.debug('耗时:', e.duration, 'ms');
        this.logger.debug('参数:', e.params);
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
