import AdmZip from "adm-zip";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { PNG } from "pngjs";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const fixtureMetadata = {
  layers: [
    {
      id: "title",
      name: "Title",
      type: "text",
      bounds: { x: 20, y: 24, width: 160, height: 32 },
      styles: { color: "#111111", fontSize: 18 }
    },
    {
      id: "hero",
      name: "Hero",
      type: "image",
      imagePath: "capture.png",
      bounds: { x: 40, y: 80, width: 100, height: 90 }
    }
  ],
  modLayerId: "page-1",
  width: 320,
  height: 240,
  capture: { imagePath: "capture.png" }
};

describe("design-to-code server", () => {
  let rootDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dtc-server-"));
    app = createApp({
      rootDir,
      publicBaseUrl: "http://localhost:3001"
    });
  });

  afterEach(async () => {
    await fs.remove(rootDir);
  });

  it("accepts a zip with index.html, injects bridge script, and returns a successful sketch record", async () => {
    const zipPath = await createZip(rootDir, {
      "index.html": "<html><body><main>Sketch</main></body></html>",
      "capture.png": createPng(320, 240, 0x4f, 0x8c, 0xff)
    });

    const upload = await request(app)
      .post("/upload")
      .attach("file", zipPath)
      .expect(201);

    expect(upload.body.id).toBeTruthy();
    expect(upload.body.entryUrl).toContain("/sketches/");
    expect(upload.body.name).toBe("visual.zip");

    const indexPath = path.join(rootDir, "sketches", upload.body.id, "index.html");
    await expect(fs.readFile(indexPath, "utf8")).resolves.toContain("__DESIGN_TO_CODE_BRIDGE__");

    const list = await request(app).get("/getSketchList").expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].id).toBe(upload.body.id);
  });

  it("rejects non-zip uploads, zips without index.html, and injection failures without adding list records", async () => {
    const textPath = path.join(rootDir, "note.txt");
    await fs.writeFile(textPath, "not a zip");

    await request(app).post("/upload").attach("file", textPath).expect(400);

    const badZip = await createZip(rootDir, { "nested/page.html": "<div />" }, "missing-index.zip");
    await request(app).post("/upload").attach("file", badZip).expect(400);

    const noBodyZip = await createZip(rootDir, { "index.html": "<html><head></head><main></main></html>" }, "no-body.zip");
    await request(app).post("/upload").attach("file", noBodyZip).expect(400);

    const list = await request(app).get("/getSketchList").expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it("deletes a sketch record and its extracted resource directory", async () => {
    const zipPath = await createZip(rootDir, {
      "index.html": "<html><body></body></html>"
    });
    const upload = await request(app).post("/upload").attach("file", zipPath).expect(201);

    await request(app).post("/deleteSketch").send({ id: upload.body.id }).expect(200);

    const list = await request(app).get("/getSketchList").expect(200);
    expect(list.body.items).toHaveLength(0);
    await expect(fs.pathExists(path.join(rootDir, "sketches", upload.body.id))).resolves.toBe(false);
  });

  it("generates layout and skeleton schemas from page metadata", async () => {
    const layout = await request(app)
      .post("/getJsonSchema")
      .send({ targetType: "page", metadata: fixtureMetadata })
      .expect(200);

    expect(layout.body.mode).toBe("layout");
    expect(layout.body.targetType).toBe("page");
    expect(layout.body.root).toMatchObject({
      id: "page-1",
      tag: "section",
      type: "page",
      bounds: { x: 0, y: 0, width: 320, height: 240 }
    });
    expect(layout.body.root.children[1].asset).toMatchObject({
      usage: "img",
      sourceImage: "capture.png",
      rect: { x: 40, y: 80, width: 100, height: 90 }
    });

    const skeleton = await request(app)
      .post("/getSkeletonSchema")
      .send({ targetType: "page", metadata: fixtureMetadata })
      .expect(200);

    expect(skeleton.body.mode).toBe("skeleton");
    expect(skeleton.body.root.children[0].type).toBe("skeleton");

    const block = await request(app)
      .post("/getJsonSchema")
      .send({ targetType: "block", metadata: { ...fixtureMetadata, modLayerId: "block-1" } })
      .expect(200);
    expect(block.body.targetType).toBe("block");
    expect(block.body.root.type).toBe("block");
  });

  it("crops images and rejects invalid rects", async () => {
    const imagePath = path.join(rootDir, "sketches", "source", "capture.png");
    await fs.ensureDir(path.dirname(imagePath));
    await fs.writeFile(imagePath, createPng(100, 100, 0xff, 0x00, 0x00));

    const crop = await request(app)
      .post("/getImage")
      .send({ sourceImage: imagePath, rect: { x: 10, y: 10, width: 30, height: 20 } })
      .expect(200);

    expect(crop.body.url).toContain("/generated/");
    const metadata = PNG.sync.read(await fs.readFile(path.join(rootDir, crop.body.url)));
    expect(metadata.width).toBe(30);
    expect(metadata.height).toBe(20);

    await request(app)
      .post("/getImage")
      .send({ sourceImage: imagePath, rect: { x: 90, y: 90, width: 30, height: 20 } })
      .expect(400);
  });

  it("generates read-only code files and references cropped image assets", async () => {
    const imagePath = path.join(rootDir, "sketches", "source", "capture.png");
    await fs.ensureDir(path.dirname(imagePath));
    await fs.writeFile(imagePath, createPng(320, 240, 0x00, 0x00, 0xff));

    const schema = await request(app)
      .post("/getJsonSchema")
      .send({
        targetType: "page",
        metadata: {
          ...fixtureMetadata,
          capture: { imagePath },
          layers: [{ ...fixtureMetadata.layers[1], imagePath }]
        }
      })
      .expect(200);

    const code = await request(app)
      .post("/getCode")
      .send({
        schema: schema.body,
        options: {
          language: "html",
          classNaming: "kebab",
          styleType: "less",
          unit: "px",
          exportType: "typescript",
          exportFormat: "component",
          styleReference: "import"
        }
      })
      .expect(200);

    expect(code.body.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "index.html", language: "html" }),
        expect.objectContaining({ path: "styles.less", language: "less" })
      ])
    );
    expect(code.body.files.map((file: { content: string }) => file.content).join("\n")).toContain("/generated/");
  });
});

async function createZip(rootDir: string, entries: Record<string, string | Buffer>, name = "visual.zip") {
  const zip = new AdmZip();
  for (const [entryName, content] of Object.entries(entries)) {
    zip.addFile(entryName, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  const zipPath = path.join(rootDir, name);
  zip.writeZip(zipPath);
  return zipPath;
}

function createPng(width: number, height: number, red: number, green: number, blue: number) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (width * y + x) << 2;
      png.data[index] = red;
      png.data[index + 1] = green;
      png.data[index + 2] = blue;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}
