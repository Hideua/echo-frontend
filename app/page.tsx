export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24 bg-white text-black">
      <div className="text-center space-y-6 max-w-3xl">
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
          Слова, которые переживут нас.
        </h1>
        <p className="text-lg md:text-xl text-neutral-700">
          Echo помогает записать послание — текст или видео — и доставить его близким в нужный момент.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <a className="px-6 py-3 rounded-full bg-black text-white font-semibold" href="/login/">
            Начать
          </a>
          <a className="px-6 py-3 rounded-full border border-neutral-300" href="/dashboard/">
            Кабинет
          </a>
        </div>
      </div>
    </main>
  );
}
