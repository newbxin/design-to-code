import {
  App as AntApp,
  Button,
  Card,
  ConfigProvider,
  Drawer,
  Empty,
  Form,
  Input,
  Layout,
  List,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Tabs,
  Tree,
  Upload,
  message
} from "antd";
import {
  CodeOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SaveOutlined,
  SettingOutlined,
  UploadOutlined
} from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import type { CodeOptions, DesignMetadata, GeneratedFile, GeneratedSchema, SchemaNode, SketchRecord } from "@design-to-code/shared";
import type { CSSProperties, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultCodeOptions, deleteSketch, getCode, getSchema, getSketchList, uploadSketch } from "./api";

type View = "list" | "preview" | "generated" | "code";
type Target = { type: "page" | "block"; metadata: DesignMetadata } | null;

export default function App() {
  return (
    <ConfigProvider theme={{ token: { borderRadius: 6, colorPrimary: "#1677ff" } }}>
      <AntApp>
        <Shell />
      </AntApp>
    </ConfigProvider>
  );
}

function Shell() {
  const [view, setView] = useState<View>("list");
  const [sketches, setSketches] = useState<SketchRecord[]>([]);
  const [activeSketch, setActiveSketch] = useState<SketchRecord | null>(null);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Target>(null);
  const [mode, setMode] = useState<"layout" | "skeleton">("layout");
  const [schema, setSchema] = useState<GeneratedSchema | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [codeOptions, setCodeOptions] = useState<CodeOptions>(defaultCodeOptions);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    void refreshSketches();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== "design-to-code-bridge") return;
      if (event.data.type === "page") setTarget({ type: "page", metadata: event.data.payload });
      if (event.data.type === "block") setTarget({ type: "block", metadata: event.data.payload });
      if (event.data.type === "empty") setTarget((current) => current ? { type: "page", metadata: current.metadata } : current);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function refreshSketches() {
    try {
      const result = await getSketchList();
      setSketches(result.items);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "获取视觉稿列表失败");
    }
  }

  function openPreview(sketch: SketchRecord) {
    setActiveSketch(sketch);
    setTarget(null);
    setSchema(null);
    setFiles([]);
    setView("preview");
    window.history.pushState({}, "", `/preview/${sketch.id}`);
  }

  async function handleUpload(file: File) {
    try {
      await uploadSketch(file);
      message.success("上传成功");
      await refreshSketches();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败");
    }
    return false;
  }

  async function handleDelete(sketch: SketchRecord) {
    try {
      await deleteSketch(sketch.id);
      setSketches((items) => items.filter((item) => item.id !== sketch.id));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  function handleEditSketch(nextSketch: SketchRecord) {
    setSketches((items) => items.map((item) => item.id === nextSketch.id ? nextSketch : item));
  }

  async function handleGenerate() {
    if (!target) {
      message.error("无法获取画板数据");
      return;
    }
    try {
      const nextSchema = await getSchema(mode, target.type, target.metadata);
      setSchema(nextSchema);
      setSelectedNodeId(nextSchema.root.id);
      const code = await getCode(nextSchema, codeOptions);
      setFiles(code.files);
      setView("generated");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成失败");
    }
  }

  async function regenerateCode(nextSchema = schema, nextOptions = codeOptions) {
    if (!nextSchema) return;
    const code = await getCode(nextSchema, nextOptions);
    setFiles(code.files);
  }

  const filteredSketches = sketches.filter((item) => item.name.includes(query) || item.description.includes(query));

  return (
    <Layout className="app-shell">
      <Layout.Header className="topbar">
        <div className="brand">Design to Code</div>
        {view !== "list" && <Button onClick={() => setView("list")}>返回列表</Button>}
      </Layout.Header>
      <Layout.Content className="main">
        {view === "list" && (
          <SketchList
            sketches={filteredSketches}
            query={query}
            onQueryChange={setQuery}
            onUpload={handleUpload}
            onOpen={openPreview}
            onEdit={handleEditSketch}
            onDelete={handleDelete}
          />
        )}
        {view === "preview" && activeSketch && (
          <PreviewPage
            sketch={activeSketch}
            iframeRef={iframeRef}
            mode={mode}
            setMode={setMode}
            target={target}
            onGenerate={handleGenerate}
          />
        )}
        {view === "generated" && schema && (
          <GeneratedPage
            schema={schema}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            setSchema={setSchema}
            onSave={() => regenerateCode()}
            onCode={() => setView("code")}
            leftCollapsed={leftCollapsed}
            rightCollapsed={rightCollapsed}
            setLeftCollapsed={setLeftCollapsed}
            setRightCollapsed={setRightCollapsed}
          />
        )}
        {view === "code" && schema && (
          <CodePage
            files={files}
            options={codeOptions}
            settingsOpen={settingsOpen}
            setSettingsOpen={setSettingsOpen}
            onBack={() => setView("generated")}
            onConfirmOptions={async (nextOptions) => {
              setCodeOptions(nextOptions);
              await regenerateCode(schema, nextOptions);
              setSettingsOpen(false);
            }}
          />
        )}
      </Layout.Content>
    </Layout>
  );
}

function SketchList(props: {
  sketches: SketchRecord[];
  query: string;
  onQueryChange: (value: string) => void;
  onUpload: (file: File) => Promise<boolean>;
  onOpen: (sketch: SketchRecord) => void;
  onEdit: (sketch: SketchRecord) => void;
  onDelete: (sketch: SketchRecord) => void;
}) {
  const [editing, setEditing] = useState<SketchRecord | null>(null);
  const [form] = Form.useForm<Pick<SketchRecord, "name" | "description">>();
  return (
    <section className="page">
      <div className="page-toolbar">
        <Input.Search placeholder="搜索视觉稿" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} allowClear />
        <Upload beforeUpload={props.onUpload} accept=".zip" showUploadList={false}>
          <Button type="primary" icon={<UploadOutlined />}>上传视觉稿</Button>
        </Upload>
      </div>
      <List
        grid={{ gutter: 16, column: 4 }}
        pagination={{ pageSize: 8 }}
        dataSource={props.sketches}
        locale={{ emptyText: <Empty description="暂无视觉稿" /> }}
        renderItem={(sketch) => (
          <List.Item>
            <Card
              className="sketch-card"
              title={<button className="card-title-button" type="button" onClick={() => props.onOpen(sketch)}>{sketch.name}</button>}
              actions={[
                <Button aria-label="预览" type="text" icon={<EyeOutlined />} onClick={() => props.onOpen(sketch)} key="open">预览</Button>,
                <Button aria-label="编辑" type="text" icon={<EditOutlined />} onClick={() => {
                  setEditing(sketch);
                  form.setFieldsValue({ name: sketch.name, description: sketch.description });
                }} key="edit">编辑</Button>,
                <Popconfirm title="确认删除视觉稿？" okText="确 定" cancelText="取 消" onConfirm={() => props.onDelete(sketch)} key="delete">
                  <Button aria-label="删除" type="text" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              ]}
            >
              <p>{sketch.description || "暂无描述"}</p>
              <span>{new Date(sketch.createTime).toLocaleString()}</span>
            </Card>
          </List.Item>
        )}
      />
      <Modal
        title="编辑视觉稿"
        open={Boolean(editing)}
        okText="确 定"
        cancelText="取 消"
        onCancel={() => setEditing(null)}
        onOk={() => {
          if (!editing) return;
          const values = form.getFieldsValue();
          props.onEdit({ ...editing, ...values });
          setEditing(null);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}

function PreviewPage(props: {
  sketch: SketchRecord;
  iframeRef: RefObject<HTMLIFrameElement>;
  mode: "layout" | "skeleton";
  setMode: (mode: "layout" | "skeleton") => void;
  target: Target;
  onGenerate: () => void;
}) {
  return (
    <section className="preview-page">
      <aside className="side-panel">
        <h2>{props.sketch.name}</h2>
        <Radio.Group value={props.mode} onChange={(event) => props.setMode(event.target.value)}>
          <Radio.Button value="layout">布局模式</Radio.Button>
          <Radio.Button value="skeleton">骨架模式</Radio.Button>
        </Radio.Group>
        <div className="target-info">当前目标：{props.target?.type === "block" ? "Block" : "Page"}</div>
        <Button aria-label="生成" type="primary" onClick={props.onGenerate}>生成</Button>
      </aside>
      <iframe
        ref={props.iframeRef}
        className="design-frame"
        title="视觉稿预览"
        src={props.sketch.entryUrl}
        onLoad={() => props.iframeRef.current?.contentWindow?.postMessage({ type: "design-to-code:get-page" }, "*")}
      />
    </section>
  );
}

function GeneratedPage(props: {
  schema: GeneratedSchema;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string) => void;
  setSchema: (schema: GeneratedSchema) => void;
  onSave: () => Promise<void> | void;
  onCode: () => void;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  setLeftCollapsed: (value: boolean) => void;
  setRightCollapsed: (value: boolean) => void;
}) {
  const selectedNode = props.selectedNodeId ? findNode(props.schema.root, props.selectedNodeId) : null;
  return (
    <section className="generated-page">
      <div className="generated-toolbar">
        <Button aria-label="保存" icon={<SaveOutlined />} type="primary" onClick={props.onSave}>保存</Button>
        <Button aria-label="代码" icon={<CodeOutlined />} onClick={props.onCode}>代码</Button>
      </div>
      <div className="generated-layout">
        {!props.leftCollapsed && (
          <aside className="tree-panel">
            <div className="panel-title">
              <span>组件树</span>
              <Button aria-label="收起组件树" icon={<MenuFoldOutlined />} onClick={() => props.setLeftCollapsed(true)} />
            </div>
            <Tree
              selectedKeys={props.selectedNodeId ? [props.selectedNodeId] : []}
              treeData={[nodeToTree(props.schema.root)]}
              onSelect={(keys) => keys[0] && props.setSelectedNodeId(String(keys[0]))}
              defaultExpandAll
            />
          </aside>
        )}
        {props.leftCollapsed && <Button className="edge-toggle left" icon={<MenuUnfoldOutlined />} onClick={() => props.setLeftCollapsed(false)} />}
        <main className="render-stage">
          <PreviewNode node={props.schema.root} selectedId={props.selectedNodeId} onSelect={props.setSelectedNodeId} />
        </main>
        {props.rightCollapsed && <Button className="edge-toggle right" icon={<MenuUnfoldOutlined />} onClick={() => props.setRightCollapsed(false)} />}
        {!props.rightCollapsed && (
          <aside className="style-panel">
            <div className="panel-title">
              <span>样式编辑</span>
              <Button aria-label="收起样式面板" icon={<MenuFoldOutlined />} onClick={() => props.setRightCollapsed(true)} />
            </div>
            <StyleEditor
              node={selectedNode}
              onPatch={(patch) => props.setSchema({ ...props.schema, root: patchNodeStyles(props.schema.root, props.selectedNodeId, patch) })}
            />
          </aside>
        )}
      </div>
    </section>
  );
}

function PreviewNode(props: { node: SchemaNode; selectedId: string | null; onSelect: (id: string) => void }) {
  const style = nodeStyle(props.node, props.node.id === props.selectedId);
  return (
    <div
      data-testid={`preview-node-${props.node.id}`}
      className="preview-node"
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        props.onSelect(props.node.id);
      }}
    >
      {props.node.asset?.usage === "img" ? null : props.node.children.map((child) => <PreviewNode key={child.id} node={child} selectedId={props.selectedId} onSelect={props.onSelect} />)}
    </div>
  );
}

function StyleEditor(props: { node: SchemaNode | null; onPatch: (patch: Record<string, string | number>) => void }) {
  if (!props.node) {
    return <Empty description="请先选中组件" />;
  }
  const styles = props.node.styles;
  return (
    <Tabs
      items={[
        { key: "font", label: "字体", children: <Input aria-label="文字颜色" value={String(styles.color ?? "")} onChange={(event) => props.onPatch({ color: event.target.value })} /> },
        { key: "layout", label: "布局", children: <Input aria-label="显示方式" value={String(styles.display ?? "")} onChange={(event) => props.onPatch({ display: event.target.value })} /> },
        { key: "position", label: "定位", children: <Input aria-label="定位方式" value={String(styles.position ?? "")} onChange={(event) => props.onPatch({ position: event.target.value })} /> },
        { key: "background", label: "背景", children: <Input aria-label="背景颜色" value={String(styles.backgroundColor ?? "")} onChange={(event) => props.onPatch({ backgroundColor: event.target.value })} /> },
        { key: "border", label: "边框", children: <Input aria-label="边框" value={String(styles.border ?? "")} onChange={(event) => props.onPatch({ border: event.target.value })} /> }
      ]}
    />
  );
}

function CodePage(props: {
  files: GeneratedFile[];
  options: CodeOptions;
  settingsOpen: boolean;
  setSettingsOpen: (value: boolean) => void;
  onBack: () => void;
  onConfirmOptions: (options: CodeOptions) => Promise<void>;
}) {
  const [activePath, setActivePath] = useState(props.files[0]?.path);
  const [form] = Form.useForm<CodeOptions>();
  const activeFile = props.files.find((file) => file.path === activePath) ?? props.files[0];
  useEffect(() => {
    setActivePath(props.files[0]?.path);
  }, [props.files]);
  return (
    <section className="code-page">
      <div className="generated-toolbar">
        <Button onClick={props.onBack}>返回预览</Button>
        <Button aria-label="设置" icon={<SettingOutlined />} onClick={() => props.setSettingsOpen(true)}>设置</Button>
      </div>
      <div className="code-layout">
        <List
          className="file-list"
          dataSource={props.files}
          renderItem={(file) => <List.Item onClick={() => setActivePath(file.path)} className={file.path === activePath ? "active" : ""}>{file.path}</List.Item>}
        />
        <pre className="code-viewer"><code>{activeFile?.content}</code></pre>
      </div>
      <Drawer title="代码设置" open={props.settingsOpen} onClose={() => props.setSettingsOpen(false)}>
        <Form form={form} layout="vertical" initialValues={props.options} onFinish={props.onConfirmOptions}>
          <Form.Item name="language" label="语言类型"><Select options={options(["html", "vue", "react"], ["HTML", "Vue", "React"])} /></Form.Item>
          <Form.Item name="classNaming" label="样式命名"><Select options={options(["camel", "kebab", "snake"], ["驼峰", "中划线", "下划线"])} /></Form.Item>
          <Form.Item name="styleType" label="样式类型"><Select options={options(["css", "less", "sass"], ["CSS", "Less", "Sass"])} /></Form.Item>
          <Form.Item name="unit" label="单位"><Select options={options(["px", "rem", "vw", "rpx"], ["px", "rem", "vw", "rpx"])} /></Form.Item>
          <Form.Item name="exportType" label="导出类型"><Select options={options(["javascript", "typescript"], ["JavaScript", "Typescript"])} /></Form.Item>
          <Form.Item name="exportFormat" label="导出格式"><Select options={options(["component", "project"], ["组件", "完整项目"])} /></Form.Item>
          <Form.Item name="styleReference" label="样式引用方式"><Select options={options(["inline", "import", "module", "module-style"], ["Inline", "Import", "Module", "Module Style"])} /></Form.Item>
          <Button aria-label="确认" htmlType="submit" type="primary">确认</Button>
        </Form>
      </Drawer>
    </section>
  );
}

function nodeToTree(node: SchemaNode): DataNode {
  return {
    key: node.id,
    title: node.name ?? `${node.tag}#${node.id}`,
    children: node.children.map(nodeToTree)
  };
}

function findNode(node: SchemaNode, id: string): SchemaNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function patchNodeStyles(node: SchemaNode, id: string | null, patch: Record<string, string | number>): SchemaNode {
  if (node.id === id) return { ...node, styles: { ...node.styles, ...patch } };
  return { ...node, children: node.children.map((child) => patchNodeStyles(child, id, patch)) };
}

function nodeStyle(node: SchemaNode, selected: boolean): CSSProperties {
  const style = node.styles as CSSProperties;
  return {
    position: node.type === "page" || node.type === "block" ? "relative" : "absolute",
    left: node.type === "page" || node.type === "block" ? undefined : node.bounds.x,
    top: node.type === "page" || node.type === "block" ? undefined : node.bounds.y,
    width: node.bounds.width,
    height: node.bounds.height,
    background: node.type === "skeleton" ? "#eef1f5" : style.backgroundColor,
    color: style.color,
    border: selected ? "1px dashed #ff4d4f" : "1px solid transparent",
    boxSizing: "border-box"
  };
}

function options(values: string[], labels: string[]) {
  return values.map((value, index) => ({ value, label: labels[index] }));
}
