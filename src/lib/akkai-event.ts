export type AkkaiEventConfig = {
  name: string;
  shortName: string;
  date: string;
  location: string;
  venue: string;
  participantRundown: readonly {
    day: string;
    date: string;
    items: readonly {
      time: string;
      title: string;
    }[];
  }[];
  arrivalDate: string;
  seminarDate: string;
  day3Date: string;
  organizer: string;
  eventHandler: string;
  registrationOpen: boolean;
};

export const AKKAI_EVENT: AkkaiEventConfig = {
  name: "Seminar Profesi Konsultan Aktuaria Indonesia, Sertifikasi CIAC dan Rapat Anggota AKKAI 2026",
  shortName: "AKKAI 2026",
  date: "19–21 Oktober 2026",
  location: "Semarang",
  venue: "Hotel Gumaya Semarang",
  participantRundown: [
    {
      day: "Day 1",
      date: "Senin, 19 Oktober 2026",
      items: [
        { time: "09.00 – 17.00", title: "Registrasi & Check-in Peserta" },
        { time: "19.00 – 22.30", title: "AKKAI Night" },
        { time: "Setelahnya", title: "Free Time / Istirahat" },
      ],
    },
    {
      day: "Day 2",
      date: "Selasa, 20 Oktober 2026",
      items: [
        { time: "06.00 – 07.00", title: "Sarapan Pagi" },
        { time: "07.00 – 08.00", title: "Registrasi Peserta" },
        { time: "08.00 – 10.00", title: "Seminar Sesi 1" },
        { time: "10.00 – 10.15", title: "Coffee Break" },
        { time: "10.15 – 11.45", title: "Seminar Sesi 1" },
        { time: "11.45 – 13.30", title: "ISHOMA" },
        { time: "13.30 – 16.00", title: "Seminar Sesi 2" },
        { time: "16.00 – 16.30", title: "Coffee Break" },
        { time: "16.30 – 18.00", title: "Seminar Sesi 2" },
        { time: "18.00 – 19.15", title: "ISHOMA" },
        { time: "19.15 – 22.00", title: "Rapat Anggota AKKAI" },
        { time: "22.00 – 22.15", title: "Penutupan & Foto Bersama" },
      ],
    },
    {
      day: "Day 3",
      date: "Rabu, 21 Oktober 2026",
      items: [
        { time: "07.00 – 08.30", title: "Sarapan Pagi & Persiapan Check-out" },
        { time: "08.30 – 09.00", title: "Pembagian Oleh-oleh & Persiapan City Tour" },
        { time: "09.00 – 09.30", title: "Perjalanan menuju lokasi kegiatan" },
        { time: "09.30 – 11.30", title: "City Tour & Wisata Batik Djadoel" },
        { time: "11.30 – 11.45", title: "Menuju Aroem Resto" },
        { time: "11.45 – 13.00", title: "Makan Siang" },
        { time: "13.00 – 15.00", title: "Wisata Belanja" },
        { time: "15.00 – 16.00", title: "Drop-off Stasiun & Bandara" },
        { time: "16.00", title: "Program Selesai" },
      ],
    },
  ],
  arrivalDate: "Senin, 19 Oktober 2026",
  seminarDate: "Selasa, 20 Oktober 2026",
  day3Date: "Rabu, 21 Oktober 2026",
  organizer: "AKKAI",
  eventHandler: "Semangat Rajawali Indonesia",
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
