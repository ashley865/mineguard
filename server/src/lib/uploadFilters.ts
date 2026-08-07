import { Request } from "express";
import multer from "multer";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"]);
const IMAGE_OR_VIDEO_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES]);
const DOCUMENT_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, "application/pdf"]);
const CONTROLLED_DOCUMENT_MIME_TYPES = new Set([
  ...DOCUMENT_MIME_TYPES,
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
]);

function makeFilter(allowed: Set<string>) {
  return (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
  };
}

// Photos only — profile pictures, mine logos, listing images.
export const imageFileFilter = makeFilter(IMAGE_MIME_TYPES);

// Photos or short video clips — hazard report evidence.
export const imageOrVideoFileFilter = makeFilter(IMAGE_OR_VIDEO_MIME_TYPES);

// Supporting documents — ID copies, certificates, payslips: images or PDF.
export const documentFileFilter = makeFilter(DOCUMENT_MIME_TYPES);

// Controlled documents — policies, procedures, drawings: office formats too.
export const controlledDocumentFileFilter = makeFilter(CONTROLLED_DOCUMENT_MIME_TYPES);
