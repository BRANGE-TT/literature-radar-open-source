# 开源开发版人工验收清单

更新日期：2026-07-14

## 单条飞书消息

- [x] 收到 `Literature Radar Open Source Dev Test`。
- [x] 中英文完整，无乱码、截断或布局异常。
- [x] 仅出现在开发测试群，未进入个人正式群。
- [x] 本条纯文本连通性消息无链接，链接检查不适用。

## 双方向完整流程

- [x] 执行前获得用户明确确认。
- [x] 共包含两篇文献，两个方向各一篇。
- [x] 标题、作者、来源、日期、DOI/链接完整，链接显示为可点击状态。
- [x] Relatedness、Venue Quality、Citation、Freshness、Final Score 显示正常。
- [x] OA-Q1 proxy 明确说明不是正式 JCR 分区。
- [x] 消息带开发测试标识，且由开发测试群截图完成验收。

## 去重与安全隔离

- [x] 开发记录使用 `DEV_TEST_SENT_PAPER_KEYS_V1`。
- [x] 本地测试确认正式属性 `PUSHED_PAPER_KEYS_V1` 不受影响。
- [x] 发送失败不会写开发测试记录。
- [x] 清理函数只删除开发测试记录。
- [x] Script ID 使用 SHA-256 指纹校验，代码和日志不含完整 ID 或凭证。

## 开发触发器

- [x] 本地测试确认 setup 只替换开发 handler，且不会产生重复触发器。
- [x] list 为只读操作；remove 只删除开发 handler。
- [x] 创建前获得用户明确确认。
- [x] 创建后核对 handler、每两日周期、时区及约 7:30 窗口。

## 下一次自动运行观察

- [x] 人工执行一次实际定时 handler `runOpenSourceDevScheduledTest()`。
- [x] 日志确认 `runMode: scheduled`，两个方向均成功发送并写入开发去重。
- [x] 等价验证后只读确认开发触发器仍为 1 个。
- [x] 自动运行状态：`PENDING OBSERVATION`。
- [ ] 下一窗口后核对 Apps Script 执行日志。
- [ ] 确认收到两个方向的推荐且没有重复。
- [ ] 确认无乱码、截断或消息错位。

## 当前阶段边界

- [x] GitHub 仓库保持 Private。
- [x] 未修改检索方向、关键词、近五年范围或评分权重。
- [x] 未操作个人稳定版项目。
- [x] 未开始配置化重构。
