export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-[18px] py-[26px] pb-[38px] sm:px-8 lg:px-10 lg:py-[38px] lg:pb-12">
      <section className="flex w-full flex-col gap-7" aria-busy="true" aria-label="Memuat dashboard">
        <div className="h-[82px] animate-pulse border-b border-[#e4d8c4] bg-[#e9dfcd] lg:h-[125px]" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6 lg:gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="h-[118px] animate-pulse rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] lg:h-36" key={index} />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="h-64 animate-pulse rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8]" key={index} />
          ))}
        </div>
        <p className="text-sm text-[#5b6c7c]">Memuat ringkasan operasional...</p>
      </section>
    </main>
  );
}
