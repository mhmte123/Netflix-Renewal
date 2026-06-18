"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import "./scss/connectAI.scss";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ResolvedTitle = { id: number; type: string; poster: string | null } | null;

const SUGGESTIONS = [
  "오늘 뭐 볼까?",
  "몰입감 있는 스릴러 추천해줘",
  "브레이킹 배드 같은 작품 추천해줘",
  "로맨스 드라마 추천해줘",
  "넷플릭스 인기작 추천해줘",
];

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TITLE_REGEX = /\[\[([^\]]+)\]\]/g;

type Props = {
  onClose: () => void;
  isClosing?: boolean;
};

export default function ConnectAIPanel({ onClose, isClosing = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resolvedTitles, setResolvedTitles] = useState<Record<string, ResolvedTitle>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const resolveTitles = async (content: string) => {
    const matches = [...content.matchAll(TITLE_REGEX)].map((m) => m[1]);
    const unique = [...new Set(matches)].filter((t) => !(t in resolvedTitles));
    if (!unique.length) return;

    const results = await Promise.all(
      unique.map(async (title): Promise<[string, ResolvedTitle]> => {
        try {
          const res = await fetch(
            `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=ko-KR`
          );
          const data = await res.json();
          const found = data.results?.find(
            (r: { media_type: string }) => r.media_type === "movie" || r.media_type === "tv"
          );
          return [title, found ? { id: found.id, type: found.media_type, poster: found.poster_path ?? null } : null];
        } catch {
          return [title, null];
        }
      })
    );

    setResolvedTitles((prev) => ({
      ...prev,
      ...Object.fromEntries(results),
    }));
  };

  // [[제목]] 패턴을 링크로 변환, 스트리밍 중엔 괄호만 제거
  const renderContent = (content: string, streaming: boolean) => {
    const parts = content.split(TITLE_REGEX);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        if (streaming) return <span key={i}>{part}</span>;
        const info = resolvedTitles[part];
        if (info) {
          return (
            <Link key={i} href={`/detail/${info.type}/${info.id}`} className="connect-ai-movie-link">
              {part} ↗
            </Link>
          );
        }
        return <span key={i} className="connect-ai-movie-title">{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const getPosterCards = (content: string) => {
    const titles = [...new Set([...content.matchAll(TITLE_REGEX)].map((m) => m[1]))];
    const cards = titles.map((title) => ({ title, info: resolvedTitles[title] })).filter(({ info }) => info?.poster);
    if (!cards.length) return null;
    return (
      <div className="connect-ai-posters">
        {cards.map(({ title, info }) => (
          <Link key={title} href={`/detail/${info!.type}/${info!.id}`} className="connect-ai-poster-card">
            <Image
              src={`https://image.tmdb.org/t/p/w185${info!.poster}`}
              alt={title}
              width={80}
              height={120}
              className="connect-ai-poster-img"
            />
            <span className="connect-ai-poster-title">{title}</span>
          </Link>
        ))}
      </div>
    );
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsLoading(true);

    const aiMsg: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, aiMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("응답 오류");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        fullContent += text;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
          return updated;
        });
      }

      // 스트리밍 완료 후 제목 TMDB 검색
      await resolveTitles(fullContent);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: "죄송해요, 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      <div className={`connect-ai-overlay${isClosing ? " connect-ai-overlay--closing" : ""}`} onClick={onClose} />

      <aside className={`connect-ai-panel${isClosing ? " connect-ai-panel--closing" : ""}`}>
        <div className="connect-ai-panel__header">
          <div className="connect-ai-panel__header-icon">
            <Image src="/images/icon/NetflixAi2.png" alt="" width={20} height={20} quality={70} />
          </div>
          <div className="connect-ai-panel__header-text">
            <span className="connect-ai-panel__header-title">Netflix AI</span>
            <span className="connect-ai-panel__header-sub">콘텐츠 추천 · 작품 탐색</span>
          </div>
          <button className="connect-ai-panel__close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="connect-ai-panel__messages">
          {messages.length === 0 ? (
            <div className="connect-ai-panel__empty">
              <div className="connect-ai-panel__empty-greeting">
                <strong>안녕하세요! Netflix AI예요 ✦</strong>
                취향에 맞는 작품을 추천해 드릴게요.
                <br />
                아무 질문이나 해보세요.
              </div>
              <div className="connect-ai-panel__suggestions">
                <span className="connect-ai-panel__suggestion-label">추천 질문</span>
                <div className="connect-ai-panel__suggestion-chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="connect-ai-panel__chip" onClick={() => sendMessage(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isStreaming = isLoading && i === messages.length - 1 && msg.role === "assistant";
              return (
                <div key={i} className={`connect-ai-message connect-ai-message--${msg.role}`}>
                  {msg.role === "assistant" && msg.content === "" && isLoading ? (
                    <div className="connect-ai-typing">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <>
                      <div className="connect-ai-message__bubble">
                        {msg.role === "assistant"
                          ? renderContent(msg.content, isStreaming)
                          : msg.content}
                      </div>
                      {msg.role === "assistant" && !isStreaming && getPosterCards(msg.content)}
                    </>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="connect-ai-panel__input-wrap">
          <div className="connect-ai-panel__input-row">
            <textarea
              ref={textareaRef}
              className="connect-ai-panel__input"
              placeholder="작품을 추천해 달라고 해보세요."
              value={input}
              rows={1}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onCompositionStart={() => { isComposingRef.current = true; }}
              onCompositionEnd={() => { isComposingRef.current = false; }}
              onKeyDown={handleKeyDown}
            />
            <button
              className="connect-ai-panel__send"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              aria-label="전송"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
