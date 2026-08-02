import "server-only";

import QRCode from "qrcode";

export async function generateParticipantQrPng(qrToken: string) {
  return QRCode.toBuffer(qrToken, {
    type: "png",
    errorCorrectionLevel: "H",
    width: 600,
    margin: 4,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}
