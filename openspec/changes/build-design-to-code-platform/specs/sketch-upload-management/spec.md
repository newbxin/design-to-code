## ADDED Requirements

### Requirement: 上传视觉稿 zip
系统必须允许用户上传 `.zip` 视觉稿包，并在服务端完成文件类型校验、解压、`index.html` 查找和元数据采集脚本注入。

#### Scenario: 上传合法 zip
- **WHEN** 用户上传包含 `index.html` 且可注入脚本的 `.zip` 文件
- **THEN** 系统必须创建视觉稿记录，并返回 `id`、`name`、`description`、`createTime`、`entryUrl`

#### Scenario: 上传非 zip 文件
- **WHEN** 用户上传非 `.zip` 文件
- **THEN** 系统必须拒绝上传并返回明确错误，且不得创建视觉稿记录

#### Scenario: zip 缺少 index.html
- **WHEN** 用户上传的 `.zip` 文件解压后不存在 `index.html`
- **THEN** 系统必须拒绝上传并返回明确错误，且不得创建视觉稿记录

#### Scenario: 注入脚本失败
- **WHEN** 服务端无法向 `index.html` 注入元数据采集脚本
- **THEN** 系统必须拒绝上传并清理临时文件，且不得创建视觉稿记录

### Requirement: 查询视觉稿列表
系统必须提供视觉稿列表查询能力，并且只返回上传成功的视觉稿记录。

#### Scenario: 查询成功记录
- **WHEN** 用户打开视觉稿列表页
- **THEN** 系统必须返回成功上传的视觉稿记录，记录包含 `id`、`name`、`description`、`createTime`、`entryUrl`

#### Scenario: 失败上传不进入列表
- **WHEN** 用户此前上传过校验失败的 zip
- **THEN** 系统不得在视觉稿列表中返回该失败上传记录

### Requirement: 删除视觉稿
系统必须允许用户删除视觉稿记录，并同步删除该视觉稿对应的解压资源目录。

#### Scenario: 删除成功
- **WHEN** 用户删除一个存在的视觉稿
- **THEN** 系统必须删除视觉稿记录和对应资源目录，并让列表不再展示该视觉稿

#### Scenario: 删除失败
- **WHEN** 服务端删除记录或资源目录失败
- **THEN** 系统必须返回错误，并且前端列表必须保持原状态
