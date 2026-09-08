export const REGISTRATION_CERTIFICATE_BUCKET = "registration-certificates";
export const REGISTRATION_CERTIFICATE_MAX_FILE_SIZE = 2 * 1024 * 1024;
export const REGISTRATION_CERTIFICATE_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
] as const;

const allowedMimeTypes = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
} as const;

export type RegistrationCertificateMetadata = {
  file_name: string;
  file_type: string;
  file_size: number;
};

function getExtension(fileName: string) {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

export function getRegistrationCertificateExtension(fileName: string) {
  return getExtension(fileName);
}

export function validateRegistrationCertificateMetadata({
  file_name,
  file_type,
  file_size,
}: RegistrationCertificateMetadata) {
  if (!file_name.trim() || file_name.length > 255) {
    return "Nama file Surat Keterangan Kerja tidak valid.";
  }

  if (!Number.isSafeInteger(file_size) || file_size <= 0) {
    return "Upload Surat Keterangan Kerja wajib diisi.";
  }

  if (file_size > REGISTRATION_CERTIFICATE_MAX_FILE_SIZE) {
    return "Ukuran Surat Keterangan Kerja maksimal 2 MiB (2.097.152 bytes).";
  }

  const extension = getExtension(file_name);
  if (!REGISTRATION_CERTIFICATE_EXTENSIONS.includes(extension as (typeof REGISTRATION_CERTIFICATE_EXTENSIONS)[number])) {
    return "Format Surat Keterangan Kerja harus PDF, JPG, JPEG, atau PNG.";
  }

  if (allowedMimeTypes[extension as keyof typeof allowedMimeTypes] !== file_type) {
    return "Tipe file Surat Keterangan Kerja tidak sesuai dengan format file.";
  }

  return null;
}

export function validateRegistrationCertificateFile(file: File | null) {
  if (!file || file.size === 0) {
    return "Upload Surat Keterangan Kerja wajib diisi.";
  }

  return validateRegistrationCertificateMetadata({
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
  });
}

export function hasExpectedRegistrationCertificateSignature(
  extension: string,
  bytes: Uint8Array,
) {
  if (extension === "pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }

  if (extension === "png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (extension === "jpg" || extension === "jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  return false;
}
