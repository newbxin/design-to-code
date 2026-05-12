## ADDED Requirements

### Requirement: 根据 schema 生成只读代码文件
系统必须提供 `/getCode`，根据完整 schema 和代码生成设置返回只读代码文件列表。

#### Scenario: 生成代码文件
- **WHEN** 前端向 `/getCode` 提交 schema 和代码生成设置
- **THEN** 系统必须返回 `files` 数组，每个文件包含 `path`、`language`、`content`

#### Scenario: 代码设置影响生成结果
- **WHEN** 前端变更语言、样式类型、单位、导出类型、导出格式或样式引用方式并确认
- **THEN** 系统必须基于当前 schema 和新的代码设置重新生成代码文件

### Requirement: 代码生成使用当前 schema
系统必须将当前前端 schema 作为代码生成的唯一输入结构，代码设置确认不得重新调用 schema 生成接口。

#### Scenario: 保留样式编辑结果
- **WHEN** 用户编辑样式后在代码预览页调整代码设置
- **THEN** 系统必须基于已编辑的当前 schema 调用 `/getCode`，并保留本次会话中的样式修改

### Requirement: 根据 rect 裁切图片资源
系统必须提供 `/getImage`，根据 `sourceImage` 和 `rect: { x, y, width, height }` 从完整视觉稿图片中裁切资源并返回图片 URL。

#### Scenario: 裁切指定区域
- **WHEN** `/getImage` 收到完整视觉稿图片标识和有效 `rect`
- **THEN** 系统必须裁切指定区域、保存图片资源，并返回可访问的图片 URL

#### Scenario: rect 无效
- **WHEN** `/getImage` 收到无效或越界的 `rect`
- **THEN** 系统必须返回错误，不得生成无效图片资源

### Requirement: 代码生成集成图片裁切
当 schema 节点需要图片资源时，`/getCode` 必须使用 `/getImage` 生成图片 URL，并在代码中引用该 URL。

#### Scenario: 生成 img 引用
- **WHEN** schema 中存在 `asset.usage` 为 `img` 的节点
- **THEN** `/getCode` 必须裁切对应图片并生成包含 `src` 引用的代码

#### Scenario: 生成 background-image 引用
- **WHEN** schema 中存在 `asset.usage` 为 `background` 的节点
- **THEN** `/getCode` 必须裁切对应图片并生成包含 `background-image` 引用的代码

#### Scenario: 图片裁切失败
- **WHEN** `/getCode` 生成过程中图片裁切失败
- **THEN** `/getCode` 必须返回代码生成失败错误
