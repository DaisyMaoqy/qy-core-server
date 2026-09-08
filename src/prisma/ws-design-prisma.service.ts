import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient as WsDesignPrismaClient } from "@prisma/ws-client";

@Injectable()
export class WsDesignPrismaService
  extends WsDesignPrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    // 钉死会话时区为 UTC，确保 DATETIME 在 dev/云都按 UTC 存储与读取
    await this.$queryRawUnsafe(`SET time_zone = '+00:00'`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
