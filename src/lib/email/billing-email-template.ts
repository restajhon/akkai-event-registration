import { formatIndonesianRupiah, PAYMENT_INSTRUCTIONS } from "@/lib/billing/pricing";

export type BillingEmailTemplateInput = {
  fullName: string;
  registrationId: string;
  billingNumber: string;
  kkaName: string;
  packageType: string;
  participationScope: string;
  amount: number;
  createdAt: string;
};

export type BillingEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[character] ?? character,
  );
}

export function createBillingEmailTemplate({
  fullName,
  registrationId,
  billingNumber,
  kkaName,
  packageType,
  participationScope,
  amount,
  createdAt,
}: BillingEmailTemplateInput): BillingEmailTemplate {
  const safe = (value: string) => escapeHtml(value);
  const formattedAmount = formatIndonesianRupiah(amount);

  return {
    subject: `Tagihan Biaya Pendaftaran ${billingNumber}`,
    html: `<!doctype html>
<html lang="id"><body style="margin:0;background:#fcf9f2;color:#263246;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fcf9f2;width:100%;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#fffdf9;border:1px solid #ddbb6a;">
        <tr><td style="padding:24px;background:#082b5a;border-bottom:4px solid #c79a35;color:#fffdf9;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;color:#ddbb6a;">AKKAI 2026</p>
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;">Tagihan Biaya Pendaftaran</h1>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Halo ${safe(fullName)},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;">Pendaftaran Anda telah berhasil disimpan. Berikut tagihan biaya pendaftaran Anda.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;background:#fcf9f2;border-left:4px solid #c79a35;"><tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px;font-size:12px;color:#667085;">Nomor Tagihan Unik</p><p style="margin:0;font-size:21px;font-weight:700;color:#082b5a;">${safe(billingNumber)}</p>
          </td></tr></table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;line-height:1.7;margin-bottom:20px;">
            <tr><td style="padding:3px 0;"><strong>Nomor registrasi:</strong> ${safe(registrationId)}</td></tr>
            <tr><td style="padding:3px 0;"><strong>Nama peserta:</strong> ${safe(fullName)}</td></tr>
            <tr><td style="padding:3px 0;"><strong>KKA:</strong> ${safe(kkaName)}</td></tr>
            <tr><td style="padding:3px 0;"><strong>Paket yang diambil:</strong> ${safe(packageType)}</td></tr>
            <tr><td style="padding:3px 0;"><strong>Pilihan mengikuti acara:</strong> ${safe(participationScope)}</td></tr>
            <tr><td style="padding:3px 0;"><strong>Rincian biaya:</strong> ${safe(packageType)} - ${formattedAmount}</td></tr>
            <tr><td style="padding:3px 0;"><strong>Tanggal pembuatan:</strong> ${safe(createdAt)}</td></tr>
          </table>
          <p style="margin:0 0 6px;font-size:14px;color:#667085;">Total tagihan</p>
          <p style="margin:0 0 20px;font-size:25px;font-weight:700;color:#082b5a;">${formattedAmount}</p>
          <p style="margin:0 0 8px;font-size:15px;font-weight:700;">Instruksi pembayaran</p>
          <p style="margin:0;font-size:14px;line-height:1.7;">${PAYMENT_INSTRUCTIONS.bank}<br>No. Rekening: ${PAYMENT_INSTRUCTIONS.accountNumber}<br>Atas Nama: ${PAYMENT_INSTRUCTIONS.accountName}<br>Batas akhir: ${PAYMENT_INSTRUCTIONS.deadline}</p>
          <p style="margin:20px 0 0;padding:12px;background:#fff9eb;border:1px solid #e5cb8c;font-size:14px;line-height:1.6;"><strong>Status pembayaran: Belum Dibayar</strong></p>
        </td></tr>
        <tr><td style="padding:20px 24px;border-top:1px solid #ddbb6a;color:#667085;font-size:12px;line-height:1.6;">Tagihan ini bukan surat resmi. Untuk konfirmasi pembayaran, kirim bukti ke ${PAYMENT_INSTRUCTIONS.proofEmail} atau ${PAYMENT_INSTRUCTIONS.proofWhatsapp}.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    text: `Halo ${fullName},

Tagihan Biaya Pendaftaran
Nomor tagihan unik: ${billingNumber}
Nomor registrasi: ${registrationId}
Nama peserta: ${fullName}
KKA: ${kkaName}
Paket yang diambil: ${packageType}
Pilihan mengikuti acara: ${participationScope}
Rincian biaya: ${packageType} - ${formattedAmount}
Tanggal pembuatan: ${createdAt}
Total tagihan: ${formattedAmount}

Instruksi pembayaran:
${PAYMENT_INSTRUCTIONS.bank}
No. Rekening: ${PAYMENT_INSTRUCTIONS.accountNumber}
Atas Nama: ${PAYMENT_INSTRUCTIONS.accountName}
Batas akhir: ${PAYMENT_INSTRUCTIONS.deadline}

Status pembayaran: Belum Dibayar

Tagihan ini bukan surat resmi. Kirim bukti pembayaran ke ${PAYMENT_INSTRUCTIONS.proofEmail} atau ${PAYMENT_INSTRUCTIONS.proofWhatsapp}.
`,
  };
}
