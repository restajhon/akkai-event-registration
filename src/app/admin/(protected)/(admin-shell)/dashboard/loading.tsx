export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1380px]" aria-busy="true" aria-label="Memuat dashboard">
        <div className="h-20 animate-pulse rounded-xl bg-[#e9dfcd]" />
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="h-32 animate-pulse rounded-xl border border-[#e4d8c4] bg-[#fffdf8]" key={index} />
          ))}
        </div>
        <p className="mt-5 text-sm text-[#5b6c7c]">Memuat ringkasan operasional...</p>
      </section>
    </main>
  );
}
