export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto max-w-[1380px]" aria-busy="true" aria-label="Memuat dashboard">
        <div className="h-20 animate-pulse rounded-xl bg-[#e9dfcd]" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="h-32 animate-pulse rounded-xl bg-[#fffdf8]" key={index} />
          ))}
        </div>
        <p className="mt-5 text-sm text-[#5b6c7c]">Memuat ringkasan operasional...</p>
      </section>
    </main>
  );
}
