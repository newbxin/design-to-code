## Why

当前项目需要建设一个“通过视觉稿、基于规则生成代码”的应用平台，让用户可以从上传视觉稿包开始，完成视觉稿预览、page/block 选择、布局或骨架屏代码生成、效果预览编辑和代码查看的完整闭环。

现在仓库中的 `client` 与 `server` 仍为空目录，适合先以端到端 MVP 的方式建立产品主流程和核心契约，后续再逐步增强生成质量、导出能力和持久化能力。

## What Changes

- 新增 React + TypeScript + Vite + Ant Design + Less 前端应用。
- 新增 Node.js + Express 后端服务。
- 支持上传 `.zip` 视觉稿包，并在服务端完成 zip 校验、解压、`index.html` 查找和元数据采集脚本注入。
- 上传失败时直接返回错误，不进入视觉稿列表。
- 支持查询视觉稿列表，列表项包含 `id`、`name`、`description`、`createTime`、`entryUrl`。
- 支持删除视觉稿记录，并同步删除对应解压资源目录。
- 支持通过 iframe 加载 `entryUrl` 预览视觉稿。
- 支持通过注入脚本与 `window.SMApp` 交互，并通过 `postMessage` 获取 page/block 元数据。
- 支持进入预览页和切换画板时缓存当前 page 元数据。
- 支持点击 block 切换生成目标，点击空白区域恢复为 page 生成目标。
- 支持布局模式调用 `/getJsonSchema` 生成完整布局 schema。
- 支持骨架模式调用 `/getSkeletonSchema` 生成 loading skeleton schema。
- 支持 `/getCode` 基于当前 schema 和代码设置生成只读代码文件。
- 支持 `/getImage` 根据 `rect: { x, y, width, height }` 从完整视觉稿图片中裁切图片资源，并供 `/getCode` 在生成 `img`、`background-image` 等代码时使用。
- 支持生成效果预览页，包括组件树、生成效果预览和样式编辑面板。
- 支持组件树和预览元素联动选中，选中元素使用红色细虚线边框标识。
- 支持样式编辑后 patch 当前前端 schema，并通过 `/getCode` 重新生成代码。
- 支持代码预览页，展示只读文件列表和只读代码内容。
- 支持代码设置抽屉，设置确认后基于当前 schema 重新调用 `/getCode`。
- MVP 不包含代码持久化、代码手动编辑、下载打包、复制代码、视觉对比、操作记录、登录权限、MDP/DevAgent 入口、样式编辑历史和跨刷新保存设置。

## Capabilities

### New Capabilities

- `sketch-upload-management`: 视觉稿 zip 上传、校验、解压、注入、列表查询和删除。
- `design-preview-metadata`: iframe 视觉稿预览、画板元数据缓存、page/block 生成目标选择和元数据桥接。
- `schema-generation`: 根据 page/block 元数据生成布局 schema 或 loading skeleton schema。
- `code-generation-assets`: 根据 schema 和代码设置生成只读代码文件，并在需要图片资源时通过矩形裁切生成图片 URL。
- `generated-preview-editing`: 生成效果预览、组件树联动选中、样式编辑、代码预览和会话态代码设置。

### Modified Capabilities

无。

## Impact

- 影响 `client/`：新增完整前端应用、页面路由、状态管理、iframe 通信、预览渲染、组件树、样式编辑和代码查看能力。
- 影响 `server/`：新增 Express 服务、上传处理、静态资源托管、视觉稿记录存储、schema 生成、代码生成和图片裁切能力。
- 新增后端接口：`/upload`、`/getSketchList`、`/deleteSketch`、`/getJsonSchema`、`/getSkeletonSchema`、`/getCode`、`/getImage`。
- 新增内部核心数据契约：`DesignMetadata`、`GeneratedSchema`、`SchemaNode`、`CodeOptions`、`GeneratedFile`、`ImageCropRequest`。
- 需要引入前端依赖 React、TypeScript、Vite、Ant Design、Less，以及服务端上传、解压、图片处理相关依赖。
