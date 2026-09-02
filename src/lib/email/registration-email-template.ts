type RegistrationEmailTemplateInput = {
  fullName: string;
  registrationId: string;
  packageType: string;
  participationScope: string;
  actuarialConsultantStatus: string;
  attendsPaiCongress: boolean | null;
};

export type RegistrationEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

const SUBJECT = "Konfirmasi Registrasi Rapat Tahunan AKKAI 2026";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export function createRegistrationEmailTemplate({
  fullName,
  registrationId,
  packageType,
  participationScope,
  actuarialConsultantStatus,
  attendsPaiCongress,
}: RegistrationEmailTemplateInput): RegistrationEmailTemplate {
  const safeFullName = escapeHtml(fullName);
  const safeRegistrationId = escapeHtml(registrationId);
  const safePackageType = escapeHtml(packageType);
  const safeParticipationScope = escapeHtml(participationScope);
  const safeActuarialConsultantStatus = escapeHtml(actuarialConsultantStatus);
  const paiCongressAnswer =
    attendsPaiCongress === null ? "-" : attendsPaiCongress ? "Ya" : "Tidak";

  return {
    subject: SUBJECT,
    html: `<!doctype html>
<html lang="id">
  <body style="margin:0;background:#fcf9f2;color:#263246;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:#fcf9f2;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#fffdf9;border:1px solid #ddbb6a;">
            <tr>
              <td style="padding:28px 32px;background:#082b5a;border-bottom:4px solid #c79a35;color:#fffdf9;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ddbb6a;">AKKAI 2026</p>
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;font-weight:700;">Konfirmasi Registrasi</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">Halo ${safeFullName},</p>
                <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">Pendaftaran Anda untuk Rapat Tahunan AKKAI 2026 telah berhasil.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;background:#fcf9f2;border-left:4px solid #c79a35;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0 0 6px;font-size:13px;color:#667085;">Nomor Registrasi</p>
                      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#082b5a;">${safeRegistrationId}</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;font-size:15px;line-height:1.7;">
                  <tr><td style="padding:3px 0;"><strong>Paket yang diambil:</strong> ${safePackageType}</td></tr>
                  <tr><td style="padding:3px 0;"><strong>Mengikuti:</strong> ${safeParticipationScope}</td></tr>
                  <tr><td style="padding:3px 0;"><strong>Konsultan Aktuaria:</strong> ${safeActuarialConsultantStatus}</td></tr>
                  <tr><td style="padding:3px 0;"><strong>Hadir Kongres PAI:</strong> ${paiCongressAnswer}</td></tr>
                </table>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.7;"><strong>Tanggal:</strong> 19–21 Oktober 2026</p>
                <p style="margin:0 0 20px;font-size:16px;line-height:1.7;"><strong>Lokasi:</strong> Semarang</p>
                <p style="margin:0 0 12px;font-size:16px;line-height:1.7;">Satu QR yang sama digunakan untuk:</p>
                <ul style="margin:0 0 24px;padding-left:22px;font-size:16px;line-height:1.7;">
                   <li>Registrasi Kedatangan — Senin, 19 Oktober 2026</li>
                   <li>Seminar AKKAI 2026 — Selasa, 20 Oktober 2026</li>
                   <li>Registrasi Day 3 — Rabu, 21 Oktober 2026</li>
                </ul>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" style="padding:20px;background:#ffffff;border:1px solid #ddbb6a;">
                      <img src="cid:akkai-registration-qr" width="480" alt="Kode QR registrasi peserta" style="display:block;width:100%;max-width:480px;height:auto;margin:0 auto;border:0;" />
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Simpan email dan kode QR ini hingga seluruh rangkaian acara selesai.</p>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#667085;"><strong>QR ini bersifat pribadi dan tidak boleh dibagikan kepada orang lain.</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;border-top:1px solid #ddbb6a;color:#667085;font-size:13px;line-height:1.6;">
                <p style="margin:0 0 4px;">Penyelenggara: AKKAI</p>
                <p style="margin:0;">Didukung oleh Eagle Spirit Indonesia</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text: `Halo ${fullName},

Pendaftaran Anda untuk Rapat Tahunan AKKAI 2026 telah berhasil.

Nomor Registrasi: ${registrationId}
Paket yang diambil: ${packageType}
Mengikuti: ${participationScope}
Konsultan Aktuaria: ${actuarialConsultantStatus}
Hadir Kongres PAI: ${paiCongressAnswer}
Tanggal: 19–21 Oktober 2026
Lokasi: Semarang

Satu QR yang sama digunakan untuk:
1. Registrasi Kedatangan — Senin, 19 Oktober 2026
2. Seminar AKKAI 2026 — Selasa, 20 Oktober 2026
3. Registrasi Day 3 — Rabu, 21 Oktober 2026

Kode QR tersedia sebagai lampiran email ini. Simpan email dan kode QR hingga seluruh rangkaian acara selesai.

QR ini bersifat pribadi dan tidak boleh dibagikan kepada orang lain.

Penyelenggara: AKKAI
Didukung oleh Eagle Spirit Indonesia
`,
  };
}
