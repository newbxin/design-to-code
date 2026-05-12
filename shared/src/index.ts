export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DesignLayer = {
  id?: string;
  objectID?: string;
  name?: string;
  type?: string;
  tag?: string;
  bounds?: Partial<Bounds>;
  frame?: Partial<Bounds>;
  rect?: Partial<Bounds>;
  styles?: Record<string, string | number>;
  imagePath?: string;
  children?: DesignLayer[];
  layers?: DesignLayer[];
};

export type DesignMetadata = {
  layers: DesignLayer[];
  modLayerId: string;
  width: number;
  height: number;
  capture: {
    imagePath: string;
  };
  name?: string;
};

export type SchemaNode = {
  id: string;
  tag: string;
  type: string;
  name?: string;
  bounds: Bounds;
  styles: Record<string, string | number>;
  asset?: {
    usage: "img" | "background";
    sourceImage: string;
    rect: Bounds;
  };
  children: SchemaNode[];
};

export type GeneratedSchema = {
  mode: "layout" | "skeleton";
  targetType: "page" | "block";
  root: SchemaNode;
};

export type CodeOptions = {
  language: "html" | "vue" | "react";
  classNaming: "camel" | "kebab" | "snake";
  styleType: "css" | "less" | "sass";
  unit: "px" | "rem" | "vw" | "rpx";
  exportType: "javascript" | "typescript";
  exportFormat: "component" | "project";
  styleReference: "inline" | "import" | "module" | "module-style";
};

export type GeneratedFile = {
  path: string;
  language: string;
  content: string;
};

export type ImageCropRequest = {
  sourceImage: string;
  rect: Bounds;
};

export type SketchRecord = {
  id: string;
  name: string;
  description: string;
  createTime: string;
  entryUrl: string;
};
