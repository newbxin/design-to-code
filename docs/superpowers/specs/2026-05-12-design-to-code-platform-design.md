# Design-to-Code Platform MVP Design

## Purpose

Build a rule-based platform that turns uploaded visual design packages into frontend code. The MVP should provide a complete workflow from uploading a design package, previewing it, generating layout or skeleton loading code from page/block metadata, editing generated styles in a preview UI, and viewing readonly generated files.

The first version prioritizes an end-to-end product loop over advanced generation quality or project persistence.

## Source Requirement

The source requirement is `docs/需求文档.md`. The frontend UI reference images live in the `UI/` directory.

The implementation should use:

- Frontend: React, TypeScript, Vite, Ant Design, Less
- Backend: Node.js, Express

## MVP Scope

The MVP includes:

- Upload a `.zip` visual design package.
- Validate and extract successful uploads.
- Inject metadata collection logic into the extracted `index.html`.
- Show successful uploads in the visual design list.
- Open a design preview page using an iframe `entryUrl`.
- Automatically request and cache current artboard page metadata.
- Refresh page metadata when switching artboards.
- Select a block as the generation target.
- Click blank canvas space to return the generation target to the current page.
- Generate layout schema through `/getJsonSchema`.
- Generate skeleton loading schema through `/getSkeletonSchema`.
- Generate readonly code files through `/getCode`.
- Crop image assets from full design images through `/getImage` when code generation requires `img` or `background-image` assets.
- Preview generated output with a component tree and style editor.
- Patch the current frontend schema when editing styles.
- Regenerate code from the current schema when saving style changes.
- View readonly code files and adjust generation settings for the current session.
- Delete a visual design record and its extracted resource directory.

The MVP excludes:

- Generated code persistence.
- Manual code editing.
- Downloading or packaging generated code.
- Copy-to-clipboard helpers.
- Visual comparison mode.
- Operation history.
- Login, permissions, or tenant management.
- MDP and DevAgent generation entry points.
- Style edit history, undo, or reset.
- Persisting code generation settings across refresh.

## Architecture Boundary

The frontend owns session state. The backend owns upload persistence, static resources, schema generation rules, code generation rules, and image cropping.

Frontend session state:

- Current design record.
- Current artboard.
- Current generation target: `page` or `block`.
- Cached page metadata.
- Selected block metadata.
- Current generated schema.
- Current style edits applied to that schema.
- Current code generation settings.
- Current readonly generated files.

Backend persistent state:

- Uploaded design records.
- Extracted resource directories.
- Injected `index.html` entry files.
- Generated image assets created by cropping.

Derived outputs:

- Layout schema.
- Skeleton loading schema.
- Generated code files.
- Generated preview render.

The schema is the central contract between preview editing and code generation.

## Frontend Flow

### Visual Design List

The list page allows users to upload `.zip` files, search designs, edit basic design information, delete designs, and open a design preview.

Only successful uploads appear in the list. Failed uploads return errors directly and do not create records.

### Visual Design Preview

The preview page loads the uploaded design through an iframe using `entryUrl`.

When the iframe loads, the frontend requests metadata for the current artboard and caches it as page metadata. When the user switches artboards, the frontend requests metadata for the new artboard and replaces the cache.

Generation target rules:

- Entering the preview page sets the target to `page`.
- Switching artboards sets the target to `page`.
- Clicking a block sets the target to `block`.
- Clicking blank space clears the block selection and returns the target to `page`.

The page supports two generation modes:

- Layout mode: call `/getJsonSchema`.
- Skeleton mode: call `/getSkeletonSchema`.

If the user clicks generate and the required page/block metadata is unavailable, the UI shows an error at generation time. The preview page does not block browsing or show early errors merely because `window.SMApp` is unavailable.

### Generated Result Preview

The result preview includes:

- Left component tree generated from schema nodes.
- Center generated render.
- Right style editor with font, layout, positioning, background, and border sections.

Selecting an element in the generated render highlights the corresponding component tree node. Selecting a component tree node highlights the preview element. The selected preview element uses a thin red dashed border.

Style edits patch `node.styles` in the current frontend schema. Clicking save regenerates code by calling `/getCode` with the current schema and current code options. The edited schema is not persisted.

### Code Preview

The code preview includes:

- Readonly file list.
- Readonly code viewer.
- Settings drawer.

The settings drawer supports:

- Language: HTML, Vue, React
- Style naming: camel case, kebab case, snake case
- Style type: CSS, Less, Sass
- Unit: px, rem, vw, rpx
- Export type: JavaScript, TypeScript
- Export format: component, full project
- Style reference mode: Inline, Import, Module, Module Style

Confirming settings calls `/getCode` with the current schema and new code options. It does not call `/getJsonSchema` or `/getSkeletonSchema` again, so current session style edits are preserved.

The code viewer is readonly. Code is a derived output from schema and settings.

## Backend API Design

### `POST /upload`

Accepts a `.zip` visual design package and optional basic metadata.

Responsibilities:

- Validate that the uploaded file is a zip package.
- Extract to a temporary directory.
- Find `index.html`.
- Inject the metadata collection and `postMessage` bridge logic.
- Move successful extraction to a stable resource directory.
- Create a design record.
- Return the design record.

Failure behavior:

- Non-zip file, extraction failure, missing `index.html`, or injection failure returns an error.
- Failed uploads do not enter the visual design list.
- Temporary files are cleaned up after failure.

Upload does not verify `window.SMApp`. Runtime metadata availability is handled when the user generates code.

### `GET /getSketchList`

Returns successful visual design records.

Each item includes:

- `id`
- `name`
- `description`
- `createTime`
- `entryUrl`

### `POST /deleteSketch`

Deletes a visual design record and its extracted resource directory.

If deletion fails, the frontend keeps the list unchanged and shows an error.

### `POST /getJsonSchema`

Accepts page or block metadata from the iframe bridge and returns a complete layout schema.

The frontend does not perform schema rule normalization. It only displays, edits, and passes the complete schema to `/getCode`.

### `POST /getSkeletonSchema`

Accepts page or block metadata from the iframe bridge and returns a complete skeleton loading schema.

Skeleton mode means loading skeleton UI. It preserves the original design layout dimensions and hierarchy, replacing real content with placeholder shapes. It should not restore real images, text, or colors except where needed for skeleton structure.

### `POST /getCode`

Accepts:

- Complete schema.
- Code generation settings.

Returns readonly generated files:

```ts
type GeneratedFile = {
  path: string;
  language: string;
  content: string;
};
```

When the schema contains image assets, `/getCode` uses `/getImage` internally to crop needed image resources and then emits image references in generated code.

### `POST /getImage`

Accepts crop information and returns a reusable image URL.

Input includes:

```ts
type ImageCropRequest = {
  sourceImage: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};
```

The endpoint crops from the full visual design image and stores the generated asset. It is primarily used during `/getCode` when generated code needs `background-image`, `img`, icon, or similar image assets.

## Metadata Bridge

After upload extraction, the server injects logic into `index.html`. The injected logic calls the design runtime API through `window.SMApp`, collects artboard/page/block metadata, normalizes it, and sends it to the parent app through `postMessage`.

Expected page or block metadata shape:

```ts
type DesignMetadata = {
  layers: unknown[];
  modLayerId: string;
  width: number;
  height: number;
  capture: {
    imagePath: string;
  };
};
```

Page generation uses cached current artboard metadata. Block generation uses selected block metadata.

## Schema Contract

The schema is the central intermediate representation used by the component tree, preview renderer, style editor, code generator, and image cropping flow.

```ts
type GeneratedSchema = {
  id: string;
  mode: "layout" | "skeleton";
  targetType: "page" | "block";
  root: SchemaNode;
};

type SchemaNode = {
  id: string;
  name?: string;
  tag: "div" | "img" | "span" | "button";
  type: "container" | "text" | "image" | "shape" | "skeleton";
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  styles: Record<string, string | number>;
  text?: string;
  asset?: {
    usage: "img" | "background";
    sourceImage: string;
    rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  children: SchemaNode[];
};
```

Rules:

- Component tree is derived from `root` recursively.
- Preview render is derived from `root` recursively.
- Style editor patches `styles` on the selected schema node.
- Save regenerates code from the current schema.
- Code settings regenerate code from the current schema.
- Image assets are represented by `asset.sourceImage` and `asset.rect`.

## Error Handling

Blocking upload errors:

- File is not a zip package.
- Zip extraction fails.
- `index.html` is missing.
- Script injection fails.

Generation errors:

- Required page/block metadata is unavailable when the user clicks generate.
- `/getJsonSchema` fails.
- `/getSkeletonSchema` fails.
- `/getCode` fails.
- `/getImage` fails while `/getCode` is generating image assets.

For generation errors, the UI remains on the current page and shows a clear error message.

## Recommended Implementation Order

1. Build server upload, extraction, injection, list, and delete endpoints.
2. Build frontend visual design list.
3. Build iframe preview, artboard/page metadata cache, target selection, and generation mode state.
4. Build schema endpoints with basic rule output.
5. Build code endpoint with basic HTML/CSS output and image crop integration.
6. Build generated result preview with component tree selection and style editor.
7. Build readonly code preview and settings drawer.
8. Add focused tests for upload validation, schema generation, code generation, target selection, and style patching.

## Success Criteria

A user can upload a valid zip, see it in the list, open the iframe preview, generate layout code or skeleton loading code from page/block metadata, inspect and style-edit the generated preview, regenerate code from the edited schema, and view readonly generated files with session-only code settings.
