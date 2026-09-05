export default function UnauthorizedAdminPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[#ead3cc] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
          AKKAI 2026
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#142842]">
          Akses tidak diizinkan
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#5b6c7c]">
          Akun Anda tidak memiliki izin untuk membuka halaman ini.
        </p>
      </section>
    </main>
  );
}
