# qy-core-server

- 对接两套**独立前端项目**: 
    - 配置/设计：低代码工单配置平台 ws-design-view
    - 流程/审批：通用审批工作流系统 approval-workflow-system

## 技术栈

- **框架**: NestJS 9
- **ORM**: Prisma 5
- **数据库**: MySQL 8.0
- **认证**: JWT
- **语言**: TypeScript
- **容器化**: Docker + Docker Compose

## 项目结构

```
qy-core-server/
├── src/
│   ├── main.ts                  # 入口文件
│   ├── app.module.ts            # 根模块（ENABLE_MODULE 开关）
│   ├── common/                  # 全局拦截器 / 过滤器 / 异常
│   ├── auth/                    # 认证/用户模块（顶层共享，后续统一用户管理）@Controller('ws/admin/auth')
│   ├── ws-design/               # ws-design 产品（配置/设计端）
│   │   ├── ws-design.product.module.ts   # 产品模块入口（引用 AuthModule + 下列子模块）
│   │   ├── ws-design.module.ts           # 设计包子模块
│   │   ├── tenant/              # 租户模块 @Controller('ws/admin/tenant')
│   │   └── app/                 # 应用模块 @Controller('ws/admin/authorization')
│   ├── approval-workflow/       # approval-workflow 产品（流程/审批端）
│   │   ├── approval-workflow.product.module.ts   # 产品模块入口（注册 JwtModule + 下列控制器/服务）
│   │   ├── common/                # 响应拦截器 / 异常过滤器 / JWT 守卫 / 当前用户装饰器 / Request 映射
│   │   ├── dto/                   # 登录 / 创建 / 动作 / 查询 / 批量 / 报表 / meta / 枚举
│   │   ├── auth/                  # AwsAuthService + AuthController（@Controller('aws/v1/auth')）
│   │   ├── users/                 # UserService + UserController（@Controller('aws/v1/users')）
│   │   └── requests/              # RequestService + 差旅/请假/跨类型/报表 控制器（@Controller('aws/v1/...')）
│   └── prisma/                  # 数据库服务
├── prisma/
│   ├── auth/schema.prisma            # auth_db：认证/用户身份库
│   ├── ws-design/schema.prisma       # ws_design_db：配置/设计业务库
│   ├── approval-workflow/schema.prisma # approval_workflow_db：审批业务库
│   ├── init.sql                      # 三库建库脚本（docker mysql 初始化时执行）
│   └── seed.ts                       # Mock 数据
├── nginx/nginx.conf            # Nginx 网关：/ws/admin→wdv、/aws→aws
├── docker-compose.yml          # Docker 双实例编排（Nginx + 双 server + mysql）
├── Dockerfile                   # Docker 镜像
├── .env                         # 默认环境变量（单实例）
├── .env.wdv                    # ws-design-view 实例配置（ENV_FILE 选择）
├── .env.aws                    # approval-workflow 实例配置
└── package.json
```

## 数据库表

| 表名 | 说明 |
|------|------|
| sys_user | 用户表（auth_db） |
| sys_tenant | 租户表（auth_db） |
| sys_user_tenant | 用户-租户关联表（auth_db） |
| sys_app | 应用表（ws_design_db） |

### approval_workflow_db 表（审批业务库）

| 表名 | 说明 |
|------|------|
| user | 审批侧用户/组织（role / managerId / department；D2 决策，auth_db 不含这些字段） |
| request | 申请单主表（业务单号 TR-#### / LV-#### 作主键） |
| trip_leg | 差旅行程段 |
| budget | 分项预算（Decimal(15,2)，对外「分」整数） |
| audit_entry | 审批留痕 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/ws/admin/auth/token` | 用户密码登录 |
| GET | `/ws/admin/auth/token/ticket` | SSO Ticket 登录 |
| GET | `/ws/admin/auth/user/getUserByNetuserid` | 获取用户信息 |
| GET | `/ws/admin/tenant/getTenantListByUserId` | 获取租户列表 |
| GET | `/ws/admin/authorization/apps` | 获取应用列表 |

### approval-workflow（流程/审批）接口（前缀 `/aws/v1`，统一响应 `{code,msg,data}`，Bearer 鉴权）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/aws/v1/auth/login` | 登录（验 auth_db 的 sysUser，签 JWT；免鉴权） |
| GET | `/aws/v1/users/me` | 当前登录用户（role / managerId / department） |
| GET | `/aws/v1/users` | 用户/组织列表（`?department=&role=`） |
| GET | `/aws/v1/users/:id` | 用户详情 |
| GET | `/aws/v1/users/:id/requests` | 某用户发起的申请 |
| GET | `/aws/v1/travel-requests` | 差旅列表（`?status=&scope=&keyword=&year=&month=`） |
| POST | `/aws/v1/travel-requests` | 新建差旅草稿（单号 TR-#### 后端生成） |
| GET | `/aws/v1/travel-requests/:id` | 差旅详情 |
| PUT | `/aws/v1/travel-requests/:id` | 编辑草稿（仅 draft/rejected） |
| DELETE | `/aws/v1/travel-requests/:id` | 删除草稿（仅 draft） |
| POST | `/aws/v1/travel-requests/:id/{submit,approve,reject,cancel,reedit}` | 状态流转 RPC |
| GET | `/aws/v1/travel-requests/meta` | 校验规则元数据 |
| GET/POST/PUT/DELETE | `/aws/v1/leave-requests/...` | 请假（与差旅对称，单号 LV-####） |
| GET | `/aws/v1/requests` | 跨类型列表（`?type=&status=&scope=mine\|todo\|all`） |
| POST | `/aws/v1/requests/batch` | 批量审批（approve/reject/cancel） |
| GET | `/aws/v1/reports/dashboard` | 看板聚合 |

> 接口契约详见前端仓库 `backend/docs/API.md` 与 `backend/docs/API-ALIGNMENT.md`（已与前端对齐：路径 `/aws/v1`、响应 `{code,msg,data}`（成功 `code:'200'`/`msg:'成功'`，HTTP 始终 200，沿用全局 `ResponseInterceptor`/`AllExceptionsFilter`）、创建/编辑 payload 用 `fields` 包裹、MySQL 用 String 枚举）。

## 快速开始

### 前置条件

- Node.js >= 18（推荐 v20.12.0）
- Docker & Docker Compose
- MySQL 8.0（或通过 Docker 启动）

### 1. 安装依赖

```bash
# 切换到 Node 20
nvm use 20.12.0

# 安装 npm 依赖
npm install

# 生成 Prisma Client（按三份 schema 分别生成，输出到 src/prisma/generated/）
npm run prisma:generate
```

### 2. 启动 MySQL

```bash
# 通过 Docker 启动 MySQL
docker-compose up -d mysql
```

### 3. 初始化数据库（DB 同步方式）

数据库采用三份独立 schema（auth_db / ws_design_db / approval_workflow_db），
使用 Prisma 的 `migrate` 流程同步结构。

```bash
# 首次建库：生成并应用三份 init 迁移（需先 docker-compose up -d mysql）
npm run prisma:migrate

# approval_workflow_db 的 schema 已扩展为真实审批域模型（User/Request/...），
# 在已存在 init 迁移的基础上需跑一次增量迁移：
npm run prisma:migrate:aws

# 插入示例数据（auth/ws-design + approval_workflow）
npm run prisma:seed
```

> 约定：开发/部署均用 `migrate`。
> - 首次建库 → `npm run prisma:migrate`（生成 `prisma/{auth,ws-design,approval-workflow}/migrations/*_init/`）；
> - approval 库结构变更 → `npm run prisma:migrate:aws`（生成增量迁移 `aws_models`）；
> - 容器启动 → `npm run prisma:deploy`（仅 `migrate deploy`，不生成文件，详见下方 Docker 部署）。

### 4. 启动后端服务

项目通过 `@nestjs/config` 自动加载 env 文件，用 `ENV_FILE` 指定加载哪一份配置（不指定则加载 `.env`）。

```bash
# 默认（加载 .env，加载全部产品模块，端口 3000，前缀 ws/admin + aws）
npm run start:prod

# 开发模式（热重载）
npm run dev

# 按产品启动独立实例（双实例部署）：ENV_FILE 选配置，ENABLE_MODULE 控制只加载该产品模块
ENV_FILE=.env.wdv ENABLE_MODULE=ws-design npm run start:prod          # ws-design-view 实例：3000 / ws/admin
ENV_FILE=.env.aws ENABLE_MODULE=approval-workflow npm run start:prod  # approval-workflow 实例：3001 / aws
```

服务默认运行在 `http://localhost:3000`（`ENV_FILE=.env.aws` 时为 `http://localhost:3001`）。

### 多产品实例（两套独立前端）

本后端对接两个独立产品，分别为其准备了实例配置：

| 实例配置 | 对应前端 | 端口 | 路由前缀 | 数据库 |
|----------|----------|------|----------|--------|
| `.env.wdv` | ws-design-view（配置/设计） | 3000 | `ws/admin` | `ws_design_db` |
| `.env.aws` | approval-workflow-system（流程/审批） | 3001 | `aws` | `approval_workflow_db` |

#### 启动单个产品实例（双实例部署）

`ENV_FILE` 选择实例配置，`ENABLE_MODULE` 控制只加载对应产品模块（不设置则加载全部，便于本地联调）：

```bash
# 仅启动 ws-design（端口 3000，前缀 ws/admin，连 ws_design_db）
ENV_FILE=.env.wdv ENABLE_MODULE=ws-design npm run start:prod

# 仅启动 approval-workflow（端口 3001，前缀 aws，连 approval_workflow_db）
ENV_FILE=.env.aws ENABLE_MODULE=approval-workflow npm run start:prod

# 开发模式同样可加 ENV_FILE / ENABLE_MODULE
ENV_FILE=.env.wdv ENABLE_MODULE=ws-design npm run dev
```

> `ENABLE_MODULE` 取值：`ws-design`、`approval-workflow`；逗号分隔可同时加载多个（如 `ws-design,approval-workflow`）。
> `approval_workflow_db` 需在阶段三创建并迁移后，aws 实例方可启动。

#### 验证路由（无需前端）

启动后可用 curl 验证两产品前缀是否生效：

```bash
# —— ws-design 产品（路径与重构前一致，前端无需改造）——
curl -X POST http://localhost:3000/ws/admin/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"userId":"admin","password":"admin123"}'
curl 'http://localhost:3000/ws/admin/tenant/getTenantListByUserId?userId=1'
curl 'http://localhost:3000/ws/admin/authorization/apps'

# —— approval-workflow 产品（流程/审批端，前缀 /aws/v1）——
# 1) 登录（验 auth_db 的 sysUser，返回 JWT；token 在 data.token）
curl -X POST http://localhost:3001/aws/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userId":"admin","password":"admin123"}'

# 2) 拿 token 后访问受保护接口（统一响应 {code,msg,data}；登录响应 token 在 data.token）
TOKEN=$(curl -s -X POST http://localhost:3001/aws/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userId":"admin","password":"admin123"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 跨类型列表（scope=mine|todo|all）
curl http://localhost:3001/aws/v1/requests -H "Authorization: Bearer $TOKEN"

# 差旅列表 / 新建草稿
curl http://localhost:3001/aws/v1/travel-requests -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3001/aws/v1/travel-requests \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"fields":{"reason":"赴客户现场支持系统上线","urgency":"normal","legs":[{"from":"北京","to":"上海","departDate":"2026-09-01","returnDate":"2026-09-03","transport":"train"}],"budget":{"transport":55300,"hotel":90000,"allowance":30000,"other":0}}}'
```

> aws 实例所有接口响应均为 `{code,msg,data}`（成功 `code:'200'`/`msg:'成功'`，HTTP 始终 200，沿用全局 `ResponseInterceptor`/`AllExceptionsFilter`），鉴权头为 `Authorization: Bearer <token>`。
> 前端对接细节见前端仓库 `backend/docs/API-ALIGNMENT.md`。

### 5. 启动前端服务

```bash
# 切换到前端项目目录
cd ../ws-design-view/ws-design

# 启动前端开发服务
npm run dev
```

前端默认运行在 `http://localhost:9528`。

## 测试账号

| 用户名 | 密码 | 用途 |
|--------|------|------|
| `admin` | `admin123` | ws-design 登录；**同时作为 approval-workflow 登录账号**（aws 登录验 auth_db 的 sysUser，按 `employeeId=userId` 映射到审批侧 User） |

### 登录流程

1. 访问 `http://localhost:9528`
2. 输入用户名 `admin`
3. 选择租户（自动加载）
4. 输入密码 `admin123`
5. 点击登录

## 环境变量

`.env` 文件配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AUTH_DATABASE_URL` | 认证库连接地址（auth_db） | `mysql://用户名:密码@主机:端口/auth_db` |
| `WS_DESIGN_DATABASE_URL` | 业务库连接地址（ws_design_db） | `mysql://用户名:密码@主机:端口/ws_design_db` |
| `AWS_DATABASE_URL` | 审批库连接地址（approval_workflow_db） | `mysql://用户名:密码@主机:端口/approval_workflow_db` |
| `JWT_SECRET` | JWT 签名密钥 | `密钥` |
| `PORT` | 服务端口 | `3000` |
| `ENABLE_MODULE` | 加载的产品模块：`ws-design` / `approval-workflow`（逗号分隔；留空=全部） | 留空 |
| `CORS_ORIGINS` | 跨域白名单，逗号分隔；留空则反射任意来源 | 留空（默认放开） |

> 前缀已写死在各 Controller（`ws/admin`、`aws`），不再用 `API_PREFIX` 控制路由。
> 以上为默认 `.env` 变量。多产品实例请使用 `.env.wdv` / `.env.aws`，通过 `ENV_FILE`
> 指定加载哪一份；其中 `PORT` / `*_DATABASE_URL` / `JWT_SECRET` / `ENABLE_MODULE` / `CORS_ORIGINS` 同样适用。
> 容器内 DB 主机名应改为 `mysql` 服务名（已在 `docker-compose.yml` 的 `environment` 中覆盖）。

## Docker 部署（双实例 + Nginx 网关，阶段四）

### 部署拓扑

```
            ┌──────────────────────────────────────────────────────┐
前端 ws-design-view   ─► :3000(宿主) ─► nginx ─► /ws/admin、/api/eoms ─► wdv :3000 ─► ws_design_db + auth_db
前端 approval-workflow─► :3000(宿主) ─► nginx ─► /aws                  ─► aws :3001 ─► approval_workflow_db + auth_db
            └──────────────────────────────────────────────────────┘
                                                   │
                                              mysql（单实例，承载 auth_db / ws_design_db / approval_workflow_db 三库）
```

- `nginx`：单入口网关，宿主 `3000` → 容器 `80`，按路径分流到两个产品实例。
- `wdv`：ws-design 实例，加载 `ws-design` 模块（前缀 `ws/admin`），`ENV_FILE=.env.wdv`。
- `aws`：approval-workflow 实例，加载 `approval-workflow` 模块（前缀 `aws`），`ENV_FILE=.env.aws`。
- `mysql`：单 MySQL 实例，由 `prisma/init.sql` 在建库时创建并授权三个独立 schema。

### 操作步骤

```bash
# 1) 启动全部：mysql 初始化三库 → wdv/aws 各跑 migrate deploy → 启动
docker-compose up -d
    # 启动mysql
    docker-compose up -d mysql 
    # 确认 MySQL 容器在运行
    docker ps | grep mysql
    # 用 docker exec 查看实际数据库
    docker exec -it qy-core-mysql mysql -u ws_design -pws_design_2026 -e "SHOW DATABASES;"
    # if 数据库都存在，则执行Prisma迁移

        # 用 root 用户给 ws_design 授权，解决Error: P3014 Prisma Migrate could not create the shadow database.

            # 进入你的 MySQL 容器
            docker exec -it qy-core-mysql bash
            # 在容器内连接 MySQL (如果root有密码，加 -p 参数)
            bash-5.1# mysql -u root -p
            # -- 授予 ws_design 用户在所有数据库上的创建、修改等权限
            mysql> GRANT CREATE, ALTER, DROP, REFERENCES ON *.* TO 'ws_design'@'%';
            # -- 刷新权限使更改生效
            mysql> FLUSH PRIVILEGES;
            # 退出 MySQL 和容器
            exit
            # 重新执行迁移命令          


# 2) 首次建库需先生成迁移文件（在能连 DB 的环境执行一次，并提交到仓库）
#    npm run prisma:migrate
#    = 对三份 schema 各 `prisma migrate dev --name init`，生成
#      prisma/{auth,ws-design,approval-workflow}/migrations/*_init/
#    生成后容器内的 `npm run prisma:deploy` 才能成功应用
#
#    approval_workflow_db 已扩展为真实审批域模型，需在 init 基础上再生成增量迁移：
#    npm run prisma:migrate:aws
#    = `prisma migrate dev --name aws_models`，生成
#      prisma/approval-workflow/migrations/*_aws_models/（同样需提交，容器 deploy 才会应用）

# 查看日志
docker-compose logs -f wdv
docker-compose logs -f aws

# 停止服务
docker-compose down
```

### DB 同步方式

- 采用 Prisma `migrate` 流程：三份 schema 各有独立迁移目录 `prisma/{auth,ws-design,approval-workflow}/migrations/`。
- **容器启动**：每个实例启动命令先执行 `npm run prisma:deploy`（= 对三份 schema 各 `prisma migrate deploy`），再 `node dist/main.js`。
- **首次**：需在能连 DB 的机器跑一次 `npm run prisma:migrate` 生成迁移文件并提交；之后 `deploy` 幂等应用。
- 应用账号 `ws_design` 已通过 `init.sql` 获三库权限，单账号访问三库。

### 验证（经 nginx 3000 入口）

```bash
# ws-design 登录
curl -X POST http://localhost:3000/ws/admin/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"userId":"admin","password":"admin123"}'

# ws-design 租户列表
curl 'http://localhost:3000/ws/admin/tenant/getTenantListByUserId?userId=1'

# approval-workflow 登录 + 列表（经 nginx 3000 入口，/aws → aws 实例）
TOKEN=$(curl -s -X POST http://localhost:3000/aws/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userId":"admin","password":"admin123"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl http://localhost:3000/aws/v1/requests -H "Authorization: Bearer $TOKEN"
```

> 若不走 Nginx、直接验证单实例，可参考上方「验证路由」章节用 3000/3001 端口分别打 wdv/aws。

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务（热重载） |
| `npm run build` | 编译项目 |
| `npm run start:prod` | 启动生产服务 |
| `npm run prisma:generate` | 按三份 schema 生成 Prisma Client |
| `npm run prisma:migrate` | 生成并应用三份 init 迁移（首次建库） |
| `npm run prisma:migrate:aws` | approval_workflow_db 增量迁移（schema 变更后） |
| `npm run prisma:deploy` | 仅应用已生成的迁移（容器启动用） |
| `npx prisma studio` | 打开 Prisma 数据管理界面 |
