import type { CodeOptions, DesignMetadata, GeneratedFile, GeneratedSchema, SketchRecord } from "@design-to-code/shared";

const apiBase = "/api";

export const defaultCodeOptions: CodeOptions = {
  language: "html",
  classNaming: "kebab",
  styleType: "css",
  unit: "px",
  exportType: "javascript",
  exportFormat: "component",
  styleReference: "import"
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? "请求失败");
  }
  return body;
}

export function getSketchList() {
  return requestJson<{ items: SketchRecord[] }>("/getSketchList");
}

export function uploadSketch(file: File) {
  const form = new FormData();
  form.append("file", file);
  return requestJson<SketchRecord>("/upload", { method: "POST", body: form });
}

export function deleteSketch(id: string) {
  return requestJson<{ ok: boolean }>("/deleteSketch", { method: "POST", body: JSON.stringify({ id }) });
}

export function getSchema(mode: "layout" | "skeleton", targetType: "page" | "block", metadata: DesignMetadata) {
  return requestJson<GeneratedSchema>(mode === "layout" ? "/getJsonSchema" : "/getSkeletonSchema", {
    method: "POST",
    body: JSON.stringify({ targetType, metadata })
  });
}

export function getCode(schema: GeneratedSchema, options: CodeOptions) {
  return requestJson<{ files: GeneratedFile[] }>("/getCode", {
    method: "POST",
    body: JSON.stringify({ schema, options })
  });
}
