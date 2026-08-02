export type AkkaiEventConfig = {
  name: string;
  shortName: string;
  date: string;
  location: string;
  arrivalDate: string;
  seminarDate: string;
  organizer: string;
  eventHandler: string;
  registrationOpen: boolean;
};

export const AKKAI_EVENT: AkkaiEventConfig = {
  name: "Rapat Tahunan AKKAI 2026",
  shortName: "AKKAI 2026",
  date: "19–21 Oktober 2026",
  location: "Semarang",
  arrivalDate: "19 Oktober 2026",
  seminarDate: "20 Oktober 2026",
  organizer: "AKKAI",
  eventHandler: "Eagle Spirit Indonesia",
  registrationOpen: true,
};

export const REGISTRATION_STEPS = [
  {
    number: 1,
    title: "Isi Formulir",
    description: "Lengkapi data diri Anda di formulir registrasi online.",
  },
  {
    number: 2,
    title: "Terima QR melalui email",
    description: "Kode QR unik akan dikirimkan ke email yang Anda daftarkan.",
  },
  {
    number: 3,
    title: "Tunjukkan kode QR",
    description: "Simpan dan tampilkan kode QR kepada panitia saat acara.",
  },
  {
    number: 4,
    title: "Kehadiran tercatat",
    description: "Kehadiran Anda dicatat untuk sesi yang diikuti.",
  },
];

export const IMPORTANT_INFO = [
  "Gunakan alamat email yang aktif.",
  "Simpan kode QR hingga seluruh rangkaian acara selesai.",
  "Satu kode QR hanya berlaku untuk satu peserta.",
  "Data yang dikirimkan digunakan untuk registrasi, komunikasi, dan administrasi acara.",
];
