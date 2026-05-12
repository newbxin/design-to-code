## ADDED Requirements

### Requirement: iframe 加载视觉稿预览
系统必须通过上传成功记录中的 `entryUrl` 在 iframe 中加载视觉稿预览。

#### Scenario: 打开视觉稿预览页
- **WHEN** 用户从视觉稿列表点击一个视觉稿
- **THEN** 系统必须进入预览页并通过 iframe 加载该视觉稿的 `entryUrl`

### Requirement: 注入脚本桥接元数据
系统必须通过注入到 `index.html` 的脚本调用 `window.SMApp` 获取视觉稿 page/block 元数据，并通过 `postMessage` 返回给前端应用。

#### Scenario: 获取 page 元数据
- **WHEN** iframe 中的注入脚本成功读取当前画板
- **THEN** 系统必须向父页面发送包含 `layers`、`modLayerId`、`width`、`height`、`capture.imagePath` 的 page 元数据

#### Scenario: 获取 block 元数据
- **WHEN** 用户在视觉稿中选中某个 block
- **THEN** 系统必须向父页面发送该 block 对应的元数据

### Requirement: 缓存当前画板 page 元数据
系统必须在进入预览页和切换画板时请求并缓存当前画板 page 元数据。

#### Scenario: 进入预览页缓存 page
- **WHEN** 用户进入视觉稿预览页且 iframe 加载完成
- **THEN** 前端必须请求当前画板 page 元数据并缓存为当前 page 生成目标

#### Scenario: 切换画板刷新缓存
- **WHEN** 用户切换到另一个画板
- **THEN** 前端必须请求新画板 page 元数据，并替换当前缓存

### Requirement: 管理 page/block 生成目标
系统必须根据用户交互维护当前生成目标，目标只能是当前 page 或当前选中 block。

#### Scenario: 默认生成 page
- **WHEN** 用户进入预览页或切换画板
- **THEN** 当前生成目标必须设置为 page

#### Scenario: 选中 block
- **WHEN** 用户点击视觉稿中的 block
- **THEN** 当前生成目标必须设置为该 block

#### Scenario: 点击空白区域
- **WHEN** 用户点击视觉稿空白区域
- **THEN** 系统必须取消 block 选择，并将当前生成目标恢复为 page

### Requirement: 生成时暴露元数据缺失错误
系统不得因为 `window.SMApp` 不可用或元数据暂未获取而提前阻断预览；系统必须在用户点击生成且缺少所需元数据时提示错误。

#### Scenario: 缺少生成元数据
- **WHEN** 用户点击生成，但当前 page/block 元数据不可用
- **THEN** 系统必须提示无法获取画板数据并停止调用 schema 生成接口
