export const REGISTRATION_PACKAGE_PRICES = {
  "Twin Share": 6_000_000,
  Single: 7_000_000,
} as const;

export type RegistrationPackage = keyof typeof REGISTRATION_PACKAGE_PRICES;

export const PAYMENT_INSTRUCTIONS = {
  bank: "Bank Mandiri",
  accountNumber: "1570007591903",
  accountName: "Asosiasi Konsultan Aktuaria Indonesia",
  proofEmail: "sekretariat@akkai.or.id",
  proofWhatsapp: "+62 812 1933 6779",
  deadline: "Jumat, 2 Oktober 2026",
} as const;

export function getRegistrationPackagePrice(packageType: string) {
  return packageType in REGISTRATION_PACKAGE_PRICES
    ? REGISTRATION_PACKAGE_PRICES[packageType as RegistrationPackage]
    : null;
}

export function formatIndonesianRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
