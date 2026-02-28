export interface EntityExtractionJobPayload {
  documentId: string;
  systemId: string;
  absolutePdfPath: string;
  requestedAt: string;
}

export interface EntityProgressUpdate {
  message: string;
  extractedCount: number;
  ruleLinkCount: number;
}
