import { Controller, Post, Get, Body, Query, Res, Req } from "@nestjs/common";
import { Response } from "express";
import { WsDesignService } from "./ws-design.service";
import { convertDatesToBeijing } from "../common/time";

@Controller("api/eoms/wsDesign")
export class WsDesignController {
  constructor(private readonly wsDesignService: WsDesignService) {}

  /**
   * POST /api/eoms/wsDesign/wsDesignPackage/pageQuery
   * 分页查询设计包
   */
  @Post("wsDesignPackage/pageQuery")
  async pageQuery(@Body() body: any) {
    const data = await this.wsDesignService.pageQuery(body);
    return { code: "0000", msg: "成功", data };
  }

  /**
   * POST /api/eoms/wsDesign/wsDesignPackage/addWsDesign
   * 新增设计包
   */
  @Post("wsDesignPackage/addWsDesign")
  async addWsDesign(@Body() body: any) {
    const data = await this.wsDesignService.addWsDesign(body);
    return { code: "0000", msg: "操作成功", data };
  }

  /**
   * POST /api/eoms/wsDesign/wsDesignPackage/updateWsDesign
   * 修改设计包
   */
  @Post("wsDesignPackage/updateWsDesign")
  async updateWsDesign(@Body() body: any) {
    const data = await this.wsDesignService.updateWsDesign(body);
    return { code: "0000", msg: "操作成功", data };
  }

  /**
   * POST /api/eoms/wsDesign/wsDesignPackage/deleteWsDesign
   * 删除设计包（Body 是 ID 数组）
   */
  @Post("wsDesignPackage/deleteWsDesign")
  async deleteWsDesign(@Body() ids: number[]) {
    await this.wsDesignService.deleteWsDesign(ids);
    return { code: "0000", msg: "删除成功", data: null };
  }

  /**
   * GET /api/eoms/wsDesign/wsDesignPackage/findWsDesignById
   * 根据ID查询设计包详情
   */
  @Get("wsDesignPackage/findWsDesignById")
  async findWsDesignById(@Query("designPackageId") designPackageId: string) {
    const data = await this.wsDesignService.findById(Number(designPackageId));
    return { code: "0000", msg: "成功", data };
  }

  /**
   * GET /api/eoms/wsDesign/wsDesignPackage/deploy
   * 部署设计包
   */
  @Get("wsDesignPackage/deploy")
  async deploy(@Query("wsDesignPackageId") wsDesignPackageId: string) {
    await this.wsDesignService.deploy(Number(wsDesignPackageId));
    return { code: "0000", msg: "部署成功", data: null };
  }

  /**
   * GET /api/eoms/wsDesign/wsDesignPackage/groupDeploy
   * 组部署
   */
  @Get("wsDesignPackage/groupDeploy")
  async groupDeploy(@Query("wsDesignPackageId") wsDesignPackageId: string) {
    await this.wsDesignService.groupDeploy(Number(wsDesignPackageId));
    return { code: "0000", msg: "部署成功", data: null };
  }

  /**
   * GET /api/eoms/wsDesign/wsDesignPackage/exportWsDesign
   * 导出设计包
   */
  @Get("wsDesignPackage/exportWsDesign")
  async exportWsDesign(
    @Query("designPackageId") designPackageId: string,
    @Res() res: Response,
  ) {
    const data = await this.wsDesignService.exportWsDesign(
      Number(designPackageId),
    );
    // 返回 JSON 数据作为文件下载（此接口用 @Res() 直写，绕过全局拦截器，
    // 需手动把时间字段转成北京时间，避免 Date 被序列化为 UTC 的 Z）
    const jsonStr = JSON.stringify(convertDatesToBeijing(data), null, 2);
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${data.name || "design-package"}.json"`,
    );
    res.send(jsonStr);
  }

  /**
   * POST /api/eoms/wsDesign/wsDesignPackage/importWsDesign
   * 导入设计包（文件上传）
   * 前端通过 el-upload 组件上传文件
   */
  @Post("wsDesignPackage/importWsDesign")
  async importWsDesign(@Req() req: any, @Body() body: any) {
    // el-upload 会将文件上传为 multipart/form-data
    // 这里尝试从 body 中解析（如果前端传的是 JSON 则直接取 body）
    let importData = body;

    // 如果 body 是文件上传的 raw body，尝试从 req 中解析
    if (req.file || (req.files && req.files.length)) {
      const file = req.file || req.files[0];
      try {
        importData = JSON.parse(file.buffer.toString("utf-8"));
      } catch {
        importData = body;
      }
    }

    const data = await this.wsDesignService.importWsDesign(importData);
    return { code: "0000", msg: "导入成功", data };
  }

  /**
   * GET /api/eoms/wsDesign/queryFormByBpmKey
   * 根据 BPM Key 查询表单信息
   */
  @Get("queryFormByBpmKey")
  async queryFormByBpmKey(@Query("bpmKey") bpmKey: string) {
    const data = await this.wsDesignService.queryFormByBpmKey(bpmKey);
    return { code: "0000", msg: "成功", data };
  }

  /**
   * GET /api/eoms/wsDesign/deploy/queryLastByWsTypeCode
   * 查询最新部署配置
   */
  @Get("deploy/queryLastByWsTypeCode")
  async queryLastByWsTypeCode(@Query("wsTypeCode") wsTypeCode: string) {
    const data = await this.wsDesignService.queryLastByWsTypeCode(wsTypeCode);
    return { code: "0000", msg: "成功", data };
  }
}
