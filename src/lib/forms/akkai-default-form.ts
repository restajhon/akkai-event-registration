import type { RegistrationFormConfig } from "@/lib/forms/form-schema";

export const AKKAI_DEFAULT_REGISTRATION_FORM: RegistrationFormConfig = {
  schemaVersion: 1,
  title: "Formulir Registrasi Seminar Profesi Konsultan Aktuaria Indonesia, Sertifikasi CIAC dan Rapat Anggota AKKAI 2026",
  instructions: "Lengkapi data berikut dengan benar untuk menyimpan pendaftaran Anda.",
  sections: [
    { id: "identitas", title: "Data Diri & Kontak", description: "Identitas peserta", position: 1 },
    { id: "akomodasi", title: "Paket yang Diambil", description: "Akomodasi kegiatan", position: 2 },
    { id: "polo", title: "Pilihan Poloshirt", description: "Pilihan Peserta", position: 3 },
    { id: "profesi", title: "Informasi Profesi & Kehadiran", description: "Status kepesertaan", position: 4 },
    { id: "persetujuan", title: "Persetujuan & Kebijakan Data", description: "Konfirmasi akhir", position: 5 },
  ],
  fields: [
    { id: "full_name", key: "full_name", type: "text", label: "Nama", placeholder: "Masukkan nama lengkap sesuai identitas", required: true, sectionId: "identitas", position: 1, system: true },
    { id: "kka_name", key: "kka_name", type: "text", label: "KKA", placeholder: "Masukkan nama KKA", required: true, sectionId: "identitas", position: 2, system: true },
    { id: "position", key: "position", type: "text", label: "Jabatan", placeholder: "Masukkan jabatan", required: true, sectionId: "identitas", position: 3, system: true },
    { id: "phone_number", key: "phone_number", type: "tel", label: "No. HP", placeholder: "Contoh: 081234567890", required: true, sectionId: "identitas", position: 4, system: true },
    { id: "email", key: "email", type: "email", label: "Alamat Email", placeholder: "nama@email.com", required: true, sectionId: "identitas", position: 5, system: true },
    { id: "package_type", key: "package_type", type: "select", label: "Paket yang diambil", required: true, options: ["Twin Share", "Single"], sectionId: "akomodasi", position: 1, system: true },
    { id: "polo_size", key: "polo_size", type: "select", label: "Ukuran Poloshirt", required: true, options: ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"], sectionId: "polo", position: 1, system: true },
    { id: "polo_model", key: "polo_model", type: "select", label: "Model Poloshirt", required: true, options: ["Lengan Panjang", "Lengan Pendek"], sectionId: "polo", position: 2, system: true },
    { id: "participation_scope", key: "participation_scope", type: "select", label: "Mengikuti", required: true, options: ["Seluruh acara", "Rapat Anggota AKKAI 2026", "Seminar Profesi Konsultan Aktuaria"], sectionId: "profesi", position: 1, system: true },
    { id: "actuarial_consultant_status", key: "actuarial_consultant_status", type: "select", label: "Status CIAC", required: false, options: ["Peserta Baru", "Penerima Grandfathering CIAC"], sectionId: "profesi", position: 2, system: true },
    { id: "attends_pai_congress", key: "attends_pai_congress", type: "select", label: "Hadir pada Kongres Persatuan Aktuaris Indonesia (PAI)", required: true, options: ["true", "false"], sectionId: "profesi", position: 3, system: true },
    { id: "certificate_file", key: "certificate_file", type: "file", label: "Surat Keterangan Kerja CIAC", required: false, sectionId: "profesi", position: 4, system: true },
    { id: "privacy_consent", key: "privacy_consent", type: "checkbox", label: "Saya menyetujui penggunaan data untuk keperluan registrasi, komunikasi, dan administrasi AKKAI 2026.", required: true, sectionId: "persetujuan", position: 1, system: true },
  ],
};
