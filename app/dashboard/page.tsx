"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

type Message = { id: string; title: string | null; created_at: string };
type Delivery = {
  id: string;
  status: string;
  send_at: string | null;
  recipient_email: string | null;
  message_title: string | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();

      const { data: session } = await sb.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        router.replace("/login");
        return;
      }

      const { data: msgs } = await sb
        .from("messages")
        .select("id,title,created_at")
        .order("created_at", { ascending: false });
      setMessages(msgs || []);

      const { data: dlvs } = await sb
        .from("deliveries")
        .select("id,status,send_at,recipient_id,message_id,created_at")
        .order("created_at", { ascending: false });

      const mapped: Delivery[] = [];
      for (const d of dlvs || []) {
        const [{ data: r }, { data: m }] = await Promise.all([
          sb.from("recipients").select("email").eq("id", d.recipient_id).single(),
          sb.from("messages").select("title").eq("id", d.message_id).single(),
        ]);
        mapped.push({
          id: d.id,
          status: d.status,
          send_at: d.send_at,
          recipient_email: r?.email ?? null,
          message_title: m?.title ?? null,
        });
      }
      setDeliveries(mapped);
      setLoading(false);
    })();
  }, [router]);

  async function logout() {
    const sb = getSupabase();
    await sb.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-black/60">Загружаем…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Личный кабинет</h1>
        <div className="flex gap-2">
          <a href="/recipients" className="px-3 py-2 rounded-xl border border-black/15 text-sm">
            Получатели
          </a>
          <a href="/compose" className="px-3 py-2 rounded-xl bg-black text-white text-sm">
            Создать послание
          </a>
          <button onClick={logout} className="px-3 py-2 rounded-xl border border-black/15 text-sm">
            Выйти
          </button>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Ваши послания</h2>
        <ul className="mt-4 space-y-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className="p-4 rounded-xl border border-black/10 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{m.title || "Без названия"}</div>
                <div className="text-xs text-black/50">
                  Создано: {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
              <a
                href={`/schedule/${m.id}`}
                className="px-3 py-2 rounded-lg border border-black/15 text-sm"
              >
                Настроить доставку
              </a>
            </li>
          ))}
          {!messages.length && <li className="text-sm text-black/60">Нет посланий.</li>}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Доставки</h2>
        <ul className="mt-4 space-y-2">
          {deliveries.map((d) => (
            <li key={d.id} className="p-4 rounded-xl border border-black/10">
              <div className="text-sm">
                <span className="font-medium">{d.message_title || "Без названия"}</span> →{" "}
                <span>{d.recipient_email || "?"}</span>
              </div>
              <div className="text-xs text-black/60 mt-1">
                Статус: {d.status}{" "}
                {d.send_at ? `• Отправка: ${new Date(d.send_at).toLocaleString()}` : ""}
              </div>
            </li>
          ))}
          {!deliveries.length && <li className="text-sm text-black/60">Доставок пока нет.</li>}
        </ul>
      </section>
    </main>
  );
}
