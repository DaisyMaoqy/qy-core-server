# 构建阶段（Debian glibc，Prisma 引擎依赖 openssl 1.1，Alpine/musl 会导致引擎无法启动）
# 启动命令：先按三份 schema 执行 migrate deploy 同步库结构，再启动服务
CMD ["sh", "-c", "npm run prisma:deploy && node dist/main.js"]FROM node:20-bullseye AS builder

WORKDIR /app

# 安装 OpenSSL（解决 Prisma 引擎依赖）
RUN apt-get update && apt-get install -y openssl

# 复制依赖文件
COPY package*.json ./

# 全量安装依赖 
RUN npm ci

# 复制源码
COPY . .

# 只针对aws
# 生成 Prisma Client（只要auth、aws）
# RUN npm run prisma:generate:aws

# 生成 Prisma Client（三份 schema）
RUN npm run prisma:generate

# 构建项目
RUN npm run build

# 运行阶段：只装生产依赖，仅拷贝编译产物
FROM node:20-bullseye

WORKDIR /app

# 运行阶段也需要 OpenSSL
RUN apt-get update && apt-get install -y openssl

COPY package*.json ./
RUN npm ci --only=production
# 部署阶段需要 prisma CLI 执行 migrate deploy（prisma 在 devDependencies，生产安装被排除，这里补装并锁定版本与 @prisma/client 一致）
RUN npm install prisma@5.22.0

# 从构建层复制打包好的代码 + prisma生成文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# 启动命令：先按三份 schema 执行 migrate deploy 同步库结构，再启动服务
CMD ["sh", "-c", "npm run prisma:deploy && node dist/main.js"]

# 只针对aws
# 启动命令：先按 schema 执行 migrate deploy 同步库结构，再启动服务
# DEPLOY_SCRIPT 可指定只跑某产品需要的迁移（如 aws 用 prisma:deploy:aws，避免依赖 ws-design 库）
# CMD ["sh", "-c", "npm run ${DEPLOY_SCRIPT:-prisma:deploy} && npm run start:prod"]