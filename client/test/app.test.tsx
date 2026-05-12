import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

const sketch = {
  id: "sketch-1",
  name: "首页视觉稿",
  description: "MVP 测试",
  createTime: "2026-05-12T12:00:00.000Z",
  entryUrl: "/sketches/sketch-1/index.html"
};

const metadata = {
  layers: [
    {
      id: "title",
      name: "Title",
      type: "text",
      bounds: { x: 20, y: 20, width: 120, height: 32 },
      styles: { color: "#222222", fontSize: 18 }
    }
  ],
  modLayerId: "page-1",
  width: 320,
  height: 240,
  capture: { imagePath: "capture.png" }
};

const schema = {
  mode: "layout",
  targetType: "page",
  root: {
    id: "page-1",
    tag: "section",
    type: "page",
    bounds: { x: 0, y: 0, width: 320, height: 240 },
    styles: { backgroundColor: "#ffffff" },
    children: [
      {
        id: "title",
        tag: "div",
        type: "text",
        bounds: { x: 20, y: 20, width: 120, height: 32 },
        styles: { color: "#222222", fontSize: 18 },
        children: []
      }
    ]
  }
};

describe("design-to-code client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.endsWith("/getSketchList")) {
        return json({ items: [sketch] });
      }
      if (url.endsWith("/getJsonSchema") || url.endsWith("/getSkeletonSchema")) {
        return json(schema);
      }
      if (url.endsWith("/getCode")) {
        return json({
          files: [
            { path: "index.html", language: "html", content: "<section>Title</section>" },
            { path: "styles.css", language: "css", content: ".page { color: #222; }" }
          ]
        });
      }
      if (url.endsWith("/deleteSketch")) {
        return json({ ok: true });
      }
      if (url.endsWith("/upload")) {
        return json(sketch, 201);
      }
      return json({ message: `Unhandled ${url} ${init?.method ?? "GET"}` }, 404);
    }));
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads successful sketches, searches them, and preserves list state when delete fails", async () => {
    render(<App />);
    expect(await screen.findByText("首页视觉稿")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("搜索视觉稿"), "首页");
    expect(screen.getByText("首页视觉稿")).toBeInTheDocument();

    vi.mocked(fetch).mockImplementationOnce(async () => json({ message: "删除失败" }, 500));
    await userEvent.click(screen.getByRole("button", { name: "删除" }));
    await userEvent.click(screen.getByRole("button", { name: "确 定" }));

    expect(await screen.findByText("首页视觉稿")).toBeInTheDocument();
  });

  it("requests page metadata from iframe, generates schema, edits style, saves code, and opens read-only code preview", async () => {
    render(<App />);
    await userEvent.click(await screen.findByText("首页视觉稿"));

    expect(await screen.findByTitle("视觉稿预览")).toHaveAttribute("src", sketch.entryUrl);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { source: "design-to-code-bridge", type: "page", payload: metadata }
      }));
    });

    await userEvent.click(screen.getByRole("button", { name: "生成" }));
    expect(await screen.findByText("组件树")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("preview-node-title"));
    expect(screen.getByTestId("preview-node-title")).toHaveStyle("border: 1px dashed #ff4d4f");

    const colorInput = screen.getByLabelText("文字颜色");
    await userEvent.clear(colorInput);
    await userEvent.type(colorInput, "#ff0000");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/getCode", expect.objectContaining({ method: "POST" }));
    });

    await userEvent.click(screen.getByRole("button", { name: "代码" }));
    expect(await screen.findByText("index.html")).toBeInTheDocument();
    expect(screen.getByText("<section>Title</section>")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "代码内容" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "设置" }));
    const drawer = await screen.findByRole("dialog");
    await userEvent.click(within(drawer).getByRole("combobox", { name: "语言类型" }));
    await userEvent.click(await screen.findByText("React"));
    await userEvent.click(within(drawer).getByRole("button", { name: "确认" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/getCode", expect.objectContaining({ method: "POST" }));
    });
  });

  it("shows an error instead of generating when metadata is missing", async () => {
    render(<App />);
    await userEvent.click(await screen.findByText("首页视觉稿"));
    await userEvent.click(screen.getByRole("button", { name: "生成" }));

    expect(await screen.findByText("无法获取画板数据")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/getJsonSchema", expect.anything());
  });
});

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  }));
}
