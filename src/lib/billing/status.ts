export type BillingPaymentStatus = "PAID" | "UNPAID";

export function billingStatusLabel(status: BillingPaymentStatus | null) {
  if (status === "PAID") {
    return "Lunas";
  }

  if (status === "UNPAID") {
    return "Belum Dibayar";
  }

  return "Belum tersedia";
}

export function billingStatusClassName(status: BillingPaymentStatus | null) {
  if (status === "PAID") {
    return "border-[#b9dec8] bg-[#f3fbf5] text-[#267044]";
  }

  if (status === "UNPAID") {
    return "border-[#e5cb8c] bg-[#fff9eb] text-[#80631e]";
  }

  return "border-[#dedbd3] bg-[#f2f0eb] text-[#6b6a66]";
}
