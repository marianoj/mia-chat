// Type for multimodal content blocks (images, files)
export type MultimodalBlock = {
  type: string;
  mimeType: string;
  data: string;
  metadata?: Record<string, unknown>;
};
