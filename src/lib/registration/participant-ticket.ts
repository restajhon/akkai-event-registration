import "server-only";

import QRCode from "qrcode";

import { AKKAI_EVENT } from "@/lib/akkai-event";
import { formatIndonesianRupiah, PAYMENT_INSTRUCTIONS } from "@/lib/billing/pricing";

export type ParticipantTicketData = {
  fullName: string;
  registrationId: string;
  email: string;
  phoneNumber: string;
  kkaName: string | null;
  packageType: string | null;
  participationScope: string | null;
  actuarialConsultantStatus: string | null;
  attendsPaiCongress: boolean | null;
  billingNumber: string | null;
  billingAmount: number | null;
  paymentStatus: "PAID" | "UNPAID" | null;
  qrToken: string;
};

function pdfText(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
  return `(${ascii.replace(/[\\()]/g, "\\$&")})`;
}

function textLine(x: number, y: number, size: number, value: string) {
  return `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm ${pdfText(value)} Tj ET\n`;
}

function paymentStatus(value: ParticipantTicketData["paymentStatus"]) {
  return value === "PAID" ? "Lunas" : value === "UNPAID" ? "Belum Dibayar" : "Belum tersedia";
}

function makePdf(objects: string[]) {
  const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  let offset = chunks[0].length;

  for (let index = 0; index < objects.length; index += 1) {
    const object = Buffer.from(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`, "utf8");
    offsets.push(offset);
    chunks.push(object);
    offset += object.length;
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  xref += offsets.slice(1).map((item) => `${String(item).padStart(10, "0")} 00000 n \n`).join("");
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "utf8"));
  return Buffer.concat(chunks);
}

function createTicketContent(data: ParticipantTicketData) {
  const qr = QRCode.create(data.qrToken, { errorCorrectionLevel: "H" });
  const moduleSize = 4;
  const qrSize = qr.modules.size * moduleSize;
  const qrX = 330 + (230 - qrSize) / 2;
  const qrY = 420;
  let content = "0.08 0.17 0.35 rg 0 0 595 842 re f\n";
  content += "1 1 1 rg 36 36 523 770 re f\n";
  content += textLine(58, 770, 11, "AKKAI 2026");
  content += textLine(58, 738, 22, "Informasi Pendaftaran Peserta");
  content += textLine(58, 712, 11, data.registrationId);
  content += "0.78 0.60 0.21 rg 58 690 479 2 re f\n";
  content += textLine(58, 652, 12, "Nama peserta");
  content += textLine(58, 630, 16, data.fullName);
  content += textLine(58, 592, 11, `Email: ${data.email}`);
  content += textLine(58, 572, 11, `No. HP: ${data.phoneNumber}`);
  content += textLine(58, 540, 11, `KKA: ${data.kkaName ?? "-"}`);
  content += textLine(58, 520, 11, `Paket: ${data.packageType ?? "-"}`);
  content += textLine(58, 500, 11, `Mengikuti: ${data.participationScope ?? "-"}`);
  content += textLine(58, 480, 11, `Status CIAC: ${data.actuarialConsultantStatus ?? "-"}`);
  content += textLine(58, 460, 11, `Hadir Kongres PAI: ${data.attendsPaiCongress === null ? "-" : data.attendsPaiCongress ? "Ya" : "Tidak"}`);
  content += textLine(58, 440, 11, `Nomor tagihan: ${data.billingNumber ?? "-"}`);
  content += textLine(58, 420, 11, `Total tagihan: ${data.billingAmount === null ? "-" : formatIndonesianRupiah(data.billingAmount)}`);
  content += textLine(58, 400, 11, `Status pembayaran: ${paymentStatus(data.paymentStatus)}`);
  content += "0.96 0.95 0.91 rg 330 390 230 290 re f\n0 0 0 rg\n";

  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) {
      if (qr.modules.get(row, column)) {
        const x = qrX + column * moduleSize;
        const y = qrY + (qr.modules.size - row - 1) * moduleSize;
        content += `${x} ${y} ${moduleSize} ${moduleSize} re f\n`;
      }
    }
  }

  content += textLine(58, 344, 11, "Detail acara");
  content += textLine(58, 324, 10, `${AKKAI_EVENT.date} | ${AKKAI_EVENT.venue}, ${AKKAI_EVENT.location}`);
  content += textLine(58, 302, 10, `Registrasi kedatangan: ${AKKAI_EVENT.arrivalDate}`);
  content += textLine(58, 282, 10, `Seminar: ${AKKAI_EVENT.seminarDate}`);
  content += textLine(58, 262, 10, `Registrasi kepulangan: ${AKKAI_EVENT.day3Date}`);
  content += textLine(58, 220, 10, "QR ini bersifat pribadi dan digunakan untuk seluruh sesi acara.");
  content += textLine(58, 200, 10, "Simpan tiket ini dan tunjukkan kepada panitia saat diperlukan.");
  content += textLine(58, 180, 9, `Pembayaran: ${PAYMENT_INSTRUCTIONS.bank}, ${PAYMENT_INSTRUCTIONS.accountNumber}`);
  content += textLine(58, 162, 9, `Bukti pembayaran: ${PAYMENT_INSTRUCTIONS.proofEmail} atau ${PAYMENT_INSTRUCTIONS.proofWhatsapp}`);
  content += textLine(58, 130, 9, `Penyelenggara: ${AKKAI_EVENT.organizer} | ${AKKAI_EVENT.eventHandler}`);
  return content;
}

export function createParticipantTicketPdf(data: ParticipantTicketData) {
  const content = Buffer.from(createTicketContent(data), "utf8");
  return makePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content.toString("utf8")}endstream`,
  ]);
}

export function participantTicketFileName(registrationId: string, fullName: string) {
  const safeName = fullName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "Peserta";
  return `${registrationId}_${safeName}.pdf`;
}
