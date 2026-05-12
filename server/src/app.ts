import AdmZip from "adm-zip";
import cors from "cors";
import express from "express";
import fs from "fs-extra";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PNG } from "pngjs";
import type {
  Bounds,
  CodeOptions,
  DesignLayer,
  DesignMetadata,
  GeneratedFile,
  GeneratedSchema,
  SchemaNode,
  SketchRecord
} from "@design-to-code/shared";

export type AppConfig = {
  rootDir?: string;
  publicBaseUrl?: string;
};

type StoredSketch = SketchRecord & {
  assetDir: string;
};

const defaultOptions: CodeOptions = {
  language: "html",
  classNaming: "kebab",
  styleType: "css",
  unit: "px",
  exportType: "javascript",
  exportFormat: "component",
  styleReference: "import"
};

export function createApp(config: AppConfig = {}) {
  const rootDir = config.rootDir ?? path.resolve(process.cwd(), "data");
  const uploadDir = path.join(rootDir, "uploads");
  const tempDir = path.join(rootDir, "tmp");
  const sketchesDir = path.join(rootDir, "sketches");
  const generatedDir = path.join(rootDir, "generated");
  const records = new Map<string, StoredSketch>();

  fs.ensureDirSync(uploadDir);
  fs.ensureDirSync(tempDir);
  fs.ensureDirSync(sketchesDir);
  fs.ensureDirSync(generatedDir);

  const app = express();
  const upload = multer({ dest: uploadDir });

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use("/sketches", express.static(sketchesDir));
  app.use("/generated", express.static(generatedDir));

  app.post("/upload", upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "请上传 zip 文件" });
      return;
    }

    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const displayName = originalName.includes("�") ? file.originalname : originalName;
    if (!displayName.toLowerCase().endsWith(".zip")) {
      await fs.remove(file.path);
      res.status(400).json({ message: "仅支持 .zip 视觉稿包" });
      return;
    }

    const id = randomUUID();
    const workingDir = path.join(tempDir, id);
    const assetDir = path.join(sketchesDir, id);

    try {
      await fs.ensureDir(workingDir);
      new AdmZip(file.path).extractAllTo(workingDir, true);
      const indexPath = await findIndexHtml(workingDir);
      if (!indexPath) {
        throw createHttpError(400, "zip 中缺少 index.html");
      }

      await injectBridge(indexPath);
      await fs.move(workingDir, assetDir, { overwrite: true });
      const relativeIndex = normalizeUrlPath(path.relative(assetDir, indexPath));
      const record: StoredSketch = {
        id,
        name: path.basename(displayName),
        description: "",
        createTime: new Date().toISOString(),
        entryUrl: `/sketches/${id}/${relativeIndex}`,
        assetDir
      };
      records.set(id, record);
      res.status(201).json(toPublicRecord(record));
    } catch (error) {
      await fs.remove(workingDir);
      await fs.remove(assetDir);
      const status = getErrorStatus(error);
      res.status(status).json({ message: error instanceof Error ? error.message : "上传失败" });
    } finally {
      await fs.remove(file.path);
    }
  });

  app.get("/getSketchList", (_req, res) => {
    res.json({ items: Array.from(records.values()).map(toPublicRecord) });
  });

  app.post("/deleteSketch", async (req, res) => {
    const id = String(req.body?.id ?? "");
    const record = records.get(id);
    if (!record) {
      res.status(404).json({ message: "视觉稿不存在" });
      return;
    }

    try {
      await fs.remove(record.assetDir);
      records.delete(id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "删除视觉稿失败" });
    }
  });

  app.post("/getJsonSchema", (req, res) => {
    try {
      res.json(createSchema(req.body?.metadata, req.body?.targetType, "layout"));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "schema 生成失败" });
    }
  });

  app.post("/getSkeletonSchema", (req, res) => {
    try {
      res.json(createSchema(req.body?.metadata, req.body?.targetType, "skeleton"));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "骨架 schema 生成失败" });
    }
  });

  app.post("/getImage", async (req, res) => {
    try {
      const url = await cropImage(req.body?.sourceImage, req.body?.rect, generatedDir);
      res.json({ url });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "裁切失败" });
    }
  });

  app.post("/getCode", async (req, res) => {
    try {
      const options = { ...defaultOptions, ...(req.body?.options ?? {}) };
      const files = await generateCode(req.body?.schema, options, generatedDir);
      res.json({ files });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "代码生成失败" });
    }
  });

  return app;
}

async function findIndexHtml(dir: string): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === "index.html") {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = await findIndexHtml(fullPath);
      if (found) return found;
    }
  }
  return null;
}

async function injectBridge(indexPath: string) {
  const html = await fs.readFile(indexPath, "utf8");
  if (!/<\/body>/i.test(html)) {
    throw createHttpError(400, "index.html 无法注入脚本");
  }
  const bridge = `<script id="__DESIGN_TO_CODE_BRIDGE__">
(function () {
  window.__DESIGN_TO_CODE_BRIDGE__ = true;
  function post(type, payload) {
    window.parent && window.parent.postMessage({ source: "design-to-code-bridge", type: type, payload: payload }, "*");
  }
  function readPage() {
    var app = window.SMApp;
    var artBoard = app && (app.getCurrentArtBoard ? app.getCurrentArtBoard() : app.currentArtBoard);
    if (!artBoard) return null;
    return {
      layers: artBoard.layers || [],
      modLayerId: artBoard.objectID || artBoard.id || "page",
      width: artBoard.width || (artBoard.frame && artBoard.frame.width) || 0,
      height: artBoard.height || (artBoard.frame && artBoard.frame.height) || 0,
      capture: { imagePath: artBoard.imagePath || "" }
    };
  }
  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "design-to-code:get-page") return;
    var page = readPage();
    if (page) post("page", page);
  });
  document.addEventListener("click", function (event) {
    var target = event.target;
    if (target && target.dataset && target.dataset.blockMetadata) {
      try { post("block", JSON.parse(target.dataset.blockMetadata)); } catch (error) {}
    } else {
      post("empty", null);
    }
  }, true);
  window.addEventListener("load", function () {
    var page = readPage();
    if (page) post("page", page);
  });
})();
</script>`;
  await fs.writeFile(indexPath, html.replace(/<\/body>/i, `${bridge}</body>`), "utf8");
}

function createSchema(metadata: DesignMetadata, targetType: "page" | "block", mode: "layout" | "skeleton"): GeneratedSchema {
  if (!metadata || !Array.isArray(metadata.layers) || !metadata.modLayerId) {
    throw new Error("metadata 无效");
  }
  const root: SchemaNode = {
    id: metadata.modLayerId,
    tag: "section",
    type: targetType === "block" ? "block" : "page",
    name: metadata.name,
    bounds: { x: 0, y: 0, width: metadata.width, height: metadata.height },
    styles: mode === "skeleton" ? skeletonStyles() : { position: "relative", width: metadata.width, height: metadata.height, backgroundColor: "#ffffff" },
    children: metadata.layers.map((layer, index) => layerToNode(layer, index, metadata.capture?.imagePath, mode))
  };
  return { mode, targetType, root };
}

function layerToNode(layer: DesignLayer, index: number, fallbackImage: string, mode: "layout" | "skeleton"): SchemaNode {
  const bounds = normalizeBounds(layer.bounds ?? layer.frame ?? layer.rect);
  const isImage = layer.type === "image" || Boolean(layer.imagePath);
  const node: SchemaNode = {
    id: layer.id ?? layer.objectID ?? `node-${index}`,
    tag: mode === "skeleton" ? "div" : isImage ? "img" : "div",
    type: mode === "skeleton" ? "skeleton" : layer.type ?? (isImage ? "image" : "container"),
    name: layer.name,
    bounds,
    styles: mode === "skeleton" ? skeletonStyles() : normalizeStyles(layer.styles, bounds),
    children: (layer.children ?? layer.layers ?? []).map((child, childIndex) => layerToNode(child, childIndex, fallbackImage, mode))
  };
  if (isImage && mode === "layout") {
    node.asset = {
      usage: node.tag === "img" ? "img" : "background",
      sourceImage: layer.imagePath ?? fallbackImage,
      rect: bounds
    };
  }
  return node;
}

function normalizeBounds(input: Partial<Bounds> | undefined): Bounds {
  return {
    x: Number(input?.x ?? 0),
    y: Number(input?.y ?? 0),
    width: Number(input?.width ?? 0),
    height: Number(input?.height ?? 0)
  };
}

function normalizeStyles(styles: Record<string, string | number> | undefined, bounds: Bounds) {
  return {
    position: "absolute",
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
    ...(styles ?? {})
  };
}

function skeletonStyles() {
  return {
    position: "absolute",
    backgroundColor: "#eef1f5",
    borderRadius: 4
  };
}

async function cropImage(sourceImage: string, rect: Bounds, generatedDir: string) {
  if (!sourceImage || !rect) throw new Error("裁切参数无效");
  const normalizedRect = normalizeBounds(rect);
  if (normalizedRect.width <= 0 || normalizedRect.height <= 0) throw new Error("rect 无效");
  const sourcePath = path.resolve(sourceImage);
  if (!(await fs.pathExists(sourcePath))) throw new Error("源图片不存在");

  const source = PNG.sync.read(await fs.readFile(sourcePath));
  if (
    normalizedRect.x < 0 ||
    normalizedRect.y < 0 ||
    normalizedRect.x + normalizedRect.width > source.width ||
    normalizedRect.y + normalizedRect.height > source.height
  ) {
    throw new Error("rect 超出图片范围");
  }

  const output = new PNG({ width: normalizedRect.width, height: normalizedRect.height });
  for (let y = 0; y < normalizedRect.height; y += 1) {
    for (let x = 0; x < normalizedRect.width; x += 1) {
      const sourceIndex = ((normalizedRect.y + y) * source.width + normalizedRect.x + x) << 2;
      const outputIndex = (y * normalizedRect.width + x) << 2;
      source.data.copy(output.data, outputIndex, sourceIndex, sourceIndex + 4);
    }
  }

  await fs.ensureDir(generatedDir);
  const filename = `${randomUUID()}.png`;
  await fs.writeFile(path.join(generatedDir, filename), PNG.sync.write(output));
  return `/generated/${filename}`;
}

async function generateCode(schema: GeneratedSchema, options: CodeOptions, generatedDir: string): Promise<GeneratedFile[]> {
  if (!schema?.root) throw new Error("schema 无效");
  const assetUrls = new Map<string, string>();
  await Promise.all(flatten(schema.root).map(async (node) => {
    if (!node.asset) return;
    const key = `${node.asset.sourceImage}:${JSON.stringify(node.asset.rect)}`;
    if (!assetUrls.has(key)) {
      assetUrls.set(key, await cropImage(node.asset.sourceImage, node.asset.rect, generatedDir));
    }
  }));

  const classNames = new Map<string, string>();
  flatten(schema.root).forEach((node) => classNames.set(node.id, formatClassName(node.name ?? node.type ?? node.id, options.classNaming)));
  const html = renderNode(schema.root, options, classNames, assetUrls);
  const styles = flatten(schema.root).map((node) => renderStyle(node, options, classNames, assetUrls)).join("\n\n");
  const styleExt = options.styleType;

  if (options.language === "react") {
    return [
      { path: `Generated.${options.exportType === "typescript" ? "tsx" : "jsx"}`, language: options.exportType === "typescript" ? "tsx" : "jsx", content: `import "./styles.${styleExt}";\n\nexport default function Generated() {\n  return (${html});\n}\n` },
      { path: `styles.${styleExt}`, language: styleExt, content: styles }
    ];
  }
  if (options.language === "vue") {
    return [
      { path: "Generated.vue", language: "vue", content: `<template>\n${html}\n</template>\n\n<style lang="${styleExt}">\n${styles}\n</style>\n` }
    ];
  }
  return [
    { path: "index.html", language: "html", content: `<!doctype html>\n<html>\n<head><link rel="stylesheet" href="./styles.${styleExt}"></head>\n<body>\n${html}\n</body>\n</html>\n` },
    { path: `styles.${styleExt}`, language: styleExt, content: styles }
  ];
}

function renderNode(node: SchemaNode, options: CodeOptions, classNames: Map<string, string>, assetUrls: Map<string, string>, depth = 1): string {
  const indent = "  ".repeat(depth);
  const className = classNames.get(node.id);
  const children = node.children.map((child) => renderNode(child, options, classNames, assetUrls, depth + 1)).join("\n");
  const assetUrl = node.asset ? assetUrls.get(`${node.asset.sourceImage}:${JSON.stringify(node.asset.rect)}`) : "";
  if (node.asset?.usage === "img") {
    return `${indent}<img class="${className}" src="${assetUrl}" alt="${escapeHtml(node.name ?? node.id)}" />`;
  }
  if (!children) return `${indent}<${node.tag} class="${className}"></${node.tag}>`;
  return `${indent}<${node.tag} class="${className}">\n${children}\n${indent}</${node.tag}>`;
}

function renderStyle(node: SchemaNode, options: CodeOptions, classNames: Map<string, string>, assetUrls: Map<string, string>) {
  const className = classNames.get(node.id);
  const declarations = Object.entries(node.styles)
    .map(([key, value]) => `  ${toKebab(key)}: ${formatStyleValue(value, options.unit)};`);
  if (node.asset?.usage === "background") {
    declarations.push(`  background-image: url("${assetUrls.get(`${node.asset.sourceImage}:${JSON.stringify(node.asset.rect)}`)}");`);
  }
  return `.${className} {\n${declarations.join("\n")}\n}`;
}

function flatten(node: SchemaNode): SchemaNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

function formatClassName(value: string, naming: CodeOptions["classNaming"]) {
  const words = value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase().split(/\s+/);
  if (naming === "camel") return words.map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)).join("");
  if (naming === "snake") return words.join("_");
  return words.join("-");
}

function formatStyleValue(value: string | number, unit: CodeOptions["unit"]) {
  if (typeof value === "number") return `${value}${unit}`;
  return value;
}

function toKebab(value: string) {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function normalizeUrlPath(value: string) {
  return value.split(path.sep).join("/");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function toPublicRecord(record: StoredSketch): SketchRecord {
  const { assetDir: _assetDir, ...publicRecord } = record;
  return publicRecord;
}

function createHttpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error ? Number((error as { status: number }).status) : 500;
}
