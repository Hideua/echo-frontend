import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-white dark:bg-gray-950">
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tighter text-gray-900 dark:text-gray-100 leading-tight">
          Твои слова. <br /> Вечно.
        </h1>
        <p className="mt-6 text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
          Оставь послание, видео или мысль. Мы доставим их тем, кого ты любишь, когда тебя уже не будет.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link
            href="/login/"
            className="inline-flex items-center justify-center rounded-full border border-transparent bg-gray-900 px-8 py-3 text-base font-medium text-white shadow-sm hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 transition-colors"
          >
            Оставить послание
          </Link>
          <Link
            href="/about/"
            className="inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Узнать больше →
          </Link>
        </div>
      </div>
    </main>
  );
}