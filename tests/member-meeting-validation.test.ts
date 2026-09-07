import { describe, expect, it } from "vitest";

import {
  getMemberMeetingFieldErrors,
  hasExpectedAuthorizationFileSignature,
  MEMBER_MEETING_MAX_FILE_SIZE,
  memberMeetingSchema,
  memberMeetingUploadMetadataSchema,
} from "@/lib/validation/member-meeting";

const baseValues = {
  name: "Pemimpin KKA",
  consulting_firm: "Kantor Konsultan Aktuaria",
  position: "Direktur",
  phone: "081234567890",
  email: "pemimpin@example.com",
  attendance_type: "SELF",
  proxy_name: "",
  proxy_position: "",
  authorization_file: null,
};

describe("member meeting validation", () => {
  it("accepts a self-attendance submission without proxy data", () => {
    expect(memberMeetingSchema.safeParse(baseValues).success).toBe(true);
  });

  it("requires proxy fields and an authorization file for proxy attendance", () => {
    const result = memberMeetingSchema.safeParse({
      ...baseValues,
      attendance_type: "PROXY",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(getMemberMeetingFieldErrors(result.error)).toMatchObject({
      proxy_name: expect.any(String),
      proxy_position: expect.any(String),
      authorization_file: expect.any(String),
    });
  });

  it("accepts allowed file extensions with their matching MIME types", () => {
    const file = new File(["%PDF-1.7"], "surat-kuasa.pdf", {
      type: "application/pdf",
    });

    const result = memberMeetingSchema.safeParse({
      ...baseValues,
      attendance_type: "PROXY",
      proxy_name: "Penerima Kuasa",
      proxy_position: "Komisaris",
      authorization_file: file,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a mismatched file MIME type", () => {
    const file = new File(["%PDF-1.7"], "surat-kuasa.pdf", {
      type: "application/octet-stream",
    });

    const result = memberMeetingSchema.safeParse({
      ...baseValues,
      attendance_type: "PROXY",
      proxy_name: "Penerima Kuasa",
      proxy_position: "Komisaris",
      authorization_file: file,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a file exactly at the 2 MiB limit", () => {
    const bytes = new Uint8Array(MEMBER_MEETING_MAX_FILE_SIZE);
    bytes.set([37, 80, 68, 70, 45]);
    const file = new File([bytes], "kuasa.pdf", {
      type: "application/pdf",
    });

    const result = memberMeetingSchema.safeParse({
      ...baseValues,
      attendance_type: "PROXY",
      proxy_name: "Penerima Kuasa",
      proxy_position: "Komisaris",
      authorization_file: file,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a file one byte above the 2 MiB limit", () => {
    const file = new File(
      [new Uint8Array(MEMBER_MEETING_MAX_FILE_SIZE + 1)],
      "kuasa.pdf",
      { type: "application/pdf" },
    );

    const result = memberMeetingSchema.safeParse({
      ...baseValues,
      attendance_type: "PROXY",
      proxy_name: "Penerima Kuasa",
      proxy_position: "Komisaris",
      authorization_file: file,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["surat.doc", "application/msword", [208, 207, 17, 224, 161, 177, 26, 225]],
    [
      "surat.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      [80, 75, 3, 4],
    ],
    ["surat.pdf", "application/pdf", [37, 80, 68, 70, 45]],
    ["surat.png", "image/png", [137, 80, 78, 71, 13, 10, 26, 10]],
    ["surat.jpg", "image/jpeg", [255, 216, 255]],
    ["surat.jpeg", "image/jpeg", [255, 216, 255]],
  ])("accepts the supported %s upload metadata and signature", (name, mime, signature) => {
    const metadataResult = memberMeetingUploadMetadataSchema.safeParse({
      file_name: name,
      file_type: mime,
      file_size: MEMBER_MEETING_MAX_FILE_SIZE,
    });

    expect(metadataResult.success).toBe(true);
    expect(
      hasExpectedAuthorizationFileSignature(
        name.split(".").pop()!,
        new Uint8Array(signature),
      ),
    ).toBe(true);
  });

  it("preserves non-ASCII filenames as valid metadata", () => {
    expect(
      memberMeetingUploadMetadataSchema.safeParse({
        file_name: "Surat Kuasa ÄKKAI 東京.pdf",
        file_type: "application/pdf",
        file_size: 1024,
      }).success,
    ).toBe(true);
  });

  it("rejects a valid MIME type with a false file signature", () => {
    expect(
      hasExpectedAuthorizationFileSignature(
        "pdf",
        new Uint8Array([80, 75, 3, 4]),
      ),
    ).toBe(false);
  });
});
