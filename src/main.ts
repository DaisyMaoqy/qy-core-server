import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { BeijingTimeInterceptor } from "./common/interceptors/beijing-time.interceptor";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe()); // 全局配置验证装饰器

  // 注意：已移除全局路由前缀。各产品模块的前缀写在各自 Controller 上：
  //   ws-design → ws/admin/*；approval-workflow → aws/*
  // 这样两个独立产品天然隔离，无需运行时区分（详见阶段三 3.2）。

  // 全局时间拦截器：响应里的 Date 统一转为北京时间 ISO（应在 ResponseInterceptor 之前，
  // 先转换原始数据再由其统一包装）
  app.useGlobalInterceptors(
    new BeijingTimeInterceptor(),
    new ResponseInterceptor(),
  );

  // 全局异常过滤器：捕获所有异常，统一返回 200，业务错误码在 body 中
  app.useGlobalFilters(new AllExceptionsFilter());

  // 允许跨域
  // CORS_ORIGINS 留空时保持原行为（反射任意来源）；配置后以逗号分隔的白名单生效
  const corsOrigins = process.env.CORS_ORIGINS;
  app.enableCors({
    origin: corsOrigins
      ? corsOrigins.split(",").map((o) => o.trim())
      : true,
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}

bootstrap();
