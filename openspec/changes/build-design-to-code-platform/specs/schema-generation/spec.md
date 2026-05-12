## ADDED Requirements

### Requirement: 生成布局 schema
系统必须提供 `/getJsonSchema`，根据 page 或 block 元数据生成完整布局 schema。

#### Scenario: 从 page 生成布局 schema
- **WHEN** 前端向 `/getJsonSchema` 提交 page 元数据
- **THEN** 系统必须返回 `mode` 为 `layout`、`targetType` 为 `page` 且包含 `root` 节点的完整 schema

#### Scenario: 从 block 生成布局 schema
- **WHEN** 前端向 `/getJsonSchema` 提交 block 元数据
- **THEN** 系统必须返回 `mode` 为 `layout`、`targetType` 为 `block` 且包含 `root` 节点的完整 schema

### Requirement: 生成 loading skeleton schema
系统必须提供 `/getSkeletonSchema`，根据 page 或 block 元数据生成 loading skeleton schema。

#### Scenario: 从 page 生成骨架屏 schema
- **WHEN** 前端向 `/getSkeletonSchema` 提交 page 元数据
- **THEN** 系统必须返回 `mode` 为 `skeleton`、`targetType` 为 `page` 且保留原布局尺寸和层级的 schema

#### Scenario: 从 block 生成骨架屏 schema
- **WHEN** 前端向 `/getSkeletonSchema` 提交 block 元数据
- **THEN** 系统必须返回 `mode` 为 `skeleton`、`targetType` 为 `block` 且保留原布局尺寸和层级的 schema

### Requirement: schema 节点契约
系统生成的 schema 节点必须包含组件树、预览、样式编辑、代码生成和图片裁切所需的数据。

#### Scenario: 节点包含基础字段
- **WHEN** 系统返回 schema 节点
- **THEN** 节点必须包含 `id`、`tag`、`type`、`bounds`、`styles`、`children`

#### Scenario: 图片节点包含裁切信息
- **WHEN** schema 节点需要生成 `img` 或 `background-image`
- **THEN** 节点必须包含 `asset.usage`、`asset.sourceImage` 和 `asset.rect`

### Requirement: 前端不整理 schema 规则
系统必须由服务端返回完整 schema，前端不得承担 layout 或 skeleton 的规则归一化职责。

#### Scenario: 前端收到 schema
- **WHEN** 前端收到 `/getJsonSchema` 或 `/getSkeletonSchema` 的响应
- **THEN** 前端必须直接使用该 schema 生成组件树、预览和后续 `/getCode` 请求
