type EventRundownDay = {
  day: string;
  date: string;
  items: readonly {
    time: string;
    title: string;
  }[];
};

export type AkkaiEventConfig = {
  name: string;
  shortName: string;
  date: string;
  location: string;
  venue: string;
  participantRundown: readonly EventRundownDay[];
  homepageRundown: readonly EventRundownDay[];
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
  homepageRundown: [
    {
      day: "Hari ke-1",
      date: "19 Oktober 2026 — AKKAI NIGHT",
      items: [
        { time: "09.00–17.00 WIB", title: "Registrasi dan Check In" },
        { time: "17.00–19.00 WIB", title: "Istirahat, Sholat dan Makan Malam" },
        { time: "19.00–23.00 WIB", title: "AKKAI NIGHT" },
        { time: "23.00 WIB", title: "Free Time dan Istirahat" },
      ],
    },
    {
      day: "Hari ke-2",
      date: "20 Oktober 2026 — Seminar",
      items: [
        { time: "06.00–07.00 WIB", title: "Sarapan Pagi" },
        { time: "07.00–08.00 WIB", title: "Registrasi" },
        { time: "08.00–08.15 WIB", title: "Pembukaan" },
        { time: "08.15–08.25 WIB", title: "Menyanyikan Lagu Indonesia Raya" },
        { time: "08.25–08.35 WIB", title: "Menyanyikan Mars AKKAI" },
        { time: "08.35–09.00 WIB", title: "Sambutan Ketua Pengurus AKKAI" },
        { time: "09.00–09.20 WIB", title: "Sambutan Otoritas Jasa Keuangan (OJK)" },
        {
          time: "09.20–09.45 WIB",
          title: "Sambutan Direktur Pembinaan dan Pengawasan Profesi Keuangan (DP2PK), sekaligus membuka Seminar Profesi Konsultan Aktuaria Indonesia & Sertifikasi CIAC",
        },
        { time: "09.45–11.45 WIB", title: "Seminar Sesi I — Sistem Pengendali Mutu dan Kode Etik AKKAI" },
        { time: "11.45–13.00 WIB", title: "Istirahat, Sholat dan Makan Siang" },
        { time: "13.00–15.00 WIB", title: "Seminar Sesi II — Standar Praktik Aktuaria (SPA) 03" },
        { time: "15.00–15.30 WIB", title: "Coffee Break" },
        { time: "15.30–16.30 WIB", title: "Sesi III — Diskusi Panel “Standar Profesional”" },
        { time: "16.30–17.30 WIB", title: "Sesi Ujian Sertifikasi CIAC" },
        { time: "17.30–17.45 WIB", title: "Penutupan dan Foto Bersama" },
        { time: "17.45–19.30 WIB", title: "Istirahat, Sholat dan Makan Malam" },
        { time: "19.30–23.00 WIB", title: "Rapat Anggota AKKAI 2026" },
      ],
    },
    {
      day: "Hari ke-3",
      date: "21 Oktober 2026 — Rapat Anggota 2 & Gathering",
      items: [
        { time: "07.00–08.00 WIB", title: "Sarapan Pagi dan Persiapan Check Out" },
        {
          time: "08.00–09.00 WIB",
          title: "Pembagian Oleh-oleh dan Pendataan Peserta yang Akan Berangkat Menuju Kongres PAI di Solo",
        },
        { time: "09.00–09.30 WIB", title: "Untuk Peserta Gathering, Perjalanan Menuju Lokasi Kegiatan" },
        { time: "09.30–11.30 WIB", title: "City Tour — Wisata Batik Djadoel" },
        { time: "11.30–11.45 WIB", title: "Menuju Aroem Resto" },
        { time: "11.45–13.00 WIB", title: "Istirahat, Sholat dan Makan Siang" },
        { time: "13.00–15.00 WIB", title: "Wisata Belanja" },
        { time: "15.00–16.00 WIB", title: "Drop-off Bus ke Solo, Stasiun dan Bandara" },
        { time: "16.00 WIB", title: "Program Selesai" },
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
