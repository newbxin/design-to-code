## Context

项目目标是建设一个通过视觉稿、基于规则生成前端代码的应用平台。当前仓库中 `client/` 与 `server/` 尚未形成实现，需求文档和 UI 截图已经明确了端到端主链路：上传视觉稿 zip、列表管理、iframe 预览、选择 page/block、生成布局或骨架屏 schema、生成代码、预览编辑、只读代码查看。

本 change 采用端到端 MVP 策略，优先建立产品闭环和核心数据契约。生成质量、导出体验、持久化编辑和更多外部入口放到后续迭代。

约束：

- 前端技术栈为 React、TypeScript、Vite、Ant Design、Less。
- 后端技术栈为 Node.js、Express。
- OpenSpec 文档必须使用中文。
- MVP 不做登录权限，不做代码下载，不做代码手动编辑，不持久化生成结果或编辑结果。

## Goals / Non-Goals

**Goals:**

- 建立 `client/` 前端应用和 `server/` 后端服务。
- 支持视觉稿 zip 上传、校验、解压、注入和列表管理。
- 通过 iframe 加载上传包中的 `entryUrl`，并通过注入脚本获取 page/block 元数据。
- 用统一 schema 作为组件树、预览、样式编辑和代码生成的中间契约。
- 支持布局模式与 loading skeleton 骨架模式。
- 支持 `/getCode` 根据 schema 和代码设置生成只读代码文件。
- 支持 `/getImage` 根据 `rect` 从完整视觉稿图片中裁切资源，供 `/getCode` 生成图片引用。
- 支持生成效果预览、组件树联动选中、样式编辑和只读代码预览。

**Non-Goals:**

- 不持久化当前 schema、样式编辑、代码设置或生成代码。
- 不支持手动编辑代码。
- 不支持下载 zip、复制代码或完整项目打包。
- 不实现 UI 图中的视觉对比功能。
- 不实现操作记录、登录权限、租户隔离。
- 不实现 MDP 或 DevAgent 生成入口。
- 不实现撤销、重置、编辑历史。

## Decisions

### 1. 采用端到端 MVP，而不是规则引擎优先或编辑器优先

选择端到端 MVP，可以最快验证上传、预览、元数据、schema、代码生成和预览编辑之间的真实衔接。规则引擎优先会推迟用户可见闭环，编辑器优先则容易脱离真实 metadata 接入。

替代方案：

- 规则引擎优先：核心更扎实，但早期难以验证产品路径。
- 预览编辑器优先：编辑体验更早成形，但后续接入真实视觉稿 metadata 风险较高。

### 2. schema 是唯一中间契约

服务端负责将 page/block metadata 转换为完整 schema。前端只消费 schema 来生成组件树、渲染预览、编辑样式，并把当前 schema 传回 `/getCode`。

这样可以避免规则逻辑分散到前端和后端两处，也能保证布局模式、骨架模式、图片裁切和代码生成共享同一结构。

### 3. 上传阶段只校验文件结构和注入能力

`/upload` 必须校验 zip、解压、`index.html` 和注入是否成功。它不校验 `window.SMApp` 是否可用，因为 `SMApp` 是 iframe 运行时能力，只有页面真正加载后才能可靠判断。

如果用户点击生成时没有可用 page/block metadata，前端在生成动作发生时提示错误。

### 4. 前端编辑和代码设置只保存在当前会话

样式编辑 patch 到当前前端 schema；保存或调整代码设置时，使用当前 schema 调用 `/getCode`。刷新页面后恢复默认状态。

这降低 MVP 的数据模型复杂度，避免引入项目版本、代码版本、编辑历史和冲突处理。

### 5. `/getImage` 是代码生成过程中的裁切能力

当 schema 节点需要 `img` 或 `background-image` 资源时，schema 节点必须携带 `asset.sourceImage` 和 `asset.rect`。`/getCode` 在生成代码时调用 `/getImage` 裁切资源，拿到 URL 后再写入代码。

这比让前端手动请求切图更稳定，因为图片资源是否需要生成是代码生成规则的一部分。

## Risks / Trade-offs

- [Risk] 上传成功但 iframe 运行时缺少 `window.SMApp`，用户只能在生成时才看到 metadata 缺失错误。 → Mitigation: 生成按钮触发时提供清晰错误提示，并保留 iframe 预览能力用于排查上传包内容。
- [Risk] 不持久化 schema 和编辑结果，刷新后用户修改会丢失。 → Mitigation: MVP 明确把编辑定位为会话态；后续可增加项目保存能力。
- [Risk] schema 设计过窄会限制后续 Vue/React、Module Style、单位转换等生成能力。 → Mitigation: 在 schema 中保留节点类型、bounds、styles、asset 和 children 等扩展字段，代码生成设置独立传入。
- [Risk] `/getImage` 反复裁切同一区域可能生成重复资源。 → Mitigation: 实现时可按 `sourceImage + rect` 做缓存或文件名哈希。
- [Risk] 骨架屏生成质量依赖 metadata 和规则质量。 → Mitigation: MVP 先保留原布局尺寸和层级，内容替换为占位块，后续再增加语义化 skeleton 规则。

## Migration Plan

当前没有已有实现和正式 specs，不涉及数据迁移。

实施步骤：

1. 创建后端服务和上传/列表/删除基础能力。
2. 创建前端应用和视觉稿列表页。
3. 接入 iframe 预览、metadata bridge 和生成目标状态。
4. 实现 schema 生成和代码生成基础链路。
5. 实现效果预览、组件树、样式编辑和代码预览。
6. 补充测试与错误处理。

回滚策略：由于是新增 change，回滚时移除新增 `client/`、`server/` 实现和对应配置即可，不影响已有业务。

## Open Questions

无。当前 MVP 边界已经确认；后续增强项应通过新的 OpenSpec change 独立提出。
