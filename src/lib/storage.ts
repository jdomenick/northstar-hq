import { supabase } from "@/integrations/supabase/client";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
} from "./constants";

export const DOCUMENTS_BUCKET = "organization-documents";

export function sanitizeFilename(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, "-");
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.slice(0, 180) || "file";
}

export function documentStoragePath(
  organizationId: string,
  documentId: string,
  filename: string,
): string {
  return `${organizationId}/documents/${documentId}/${sanitizeFilename(filename)}`;
}

export function validateDocumentFile(file: File): string | null {
  if (file.size <= 0) return "Empty file";
  if (file.size > MAX_DOCUMENT_BYTES) {
    const mb = Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024));
    return `File too large. Max ${mb} MB.`;
  }
  const type = file.type || "";
  if (type && !ALLOWED_DOCUMENT_MIME_TYPES.includes(type)) {
    return "Unsupported file type";
  }
  return null;
}

export async function createSignedDocumentUrl(
  filePath: string,
  expiresIn = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(filePath, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not create download link");
  }
  return data.signedUrl;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return " - ";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}