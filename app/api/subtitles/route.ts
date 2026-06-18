import { NextResponse } from "next/server";
import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

/**
 * 자막 API — GET /api/subtitles?v=VIDEO_ID&lang=ko
 *
 * 하이브리드 전략:
 *  1. 로컬 자막 파일 (public/subtitles/{videoId}.json) — 주요 작품용, 풀 커스텀 보장
 *  2. 유튜브 timedtext 시도 — 현재 유튜브가 서버 요청을 429로 차단 중이라 대부분 실패하지만,
 *     향후 풀리거나 환경에 따라 성공할 수 있어 유지 (한국어 외 트랙은 Groq 번역)
 *  3. 둘 다 실패 → cues 빈 배열 (클라이언트는 유튜브 내장 자막으로 폴백)
 */

interface Cue {
  start: number;
  end: number;
  text: string;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // "asr" = 자동 생성
  isTranslatable?: boolean;
}

// 성공 결과만 캐시 (24시간)
const cache = new Map<string, { cues: Cue[]; source: string; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/* ──────────────── 1) 로컬 자막 파일 ──────────────── */

/** public/subtitles/{videoId}.json — [{start,end,text}] 또는 {cues:[...]} 형식 */
async function cuesFromLocalFile(videoId: string): Promise<Cue[]> {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "subtitles",
      `${videoId}.json`,
    );
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw);
    const list: any[] = Array.isArray(data) ? data : (data.cues ?? []);
    return list
      .map((c) => ({
        start: Number(c.start),
        end: Number(c.end),
        text: String(c.text ?? "").trim(),
      }))
      .filter((c) => Number.isFinite(c.start) && c.text.length > 0);
  } catch {
    return []; // 파일 없음
  }
}

/* ──────────────── 2) 유튜브 timedtext ──────────────── */

/** "captionTracks": 뒤의 JSON 배열을 괄호 균형으로 안전하게 추출 */
function extractCaptionTracks(html: string): CaptionTrack[] | null {
  const key = '"captionTracks":';
  const idx = html.indexOf(key);
  if (idx === -1) return null;
  const start = html.indexOf("[", idx);
  if (start === -1) return null;

  let depth = 0;
  for (let j = start; j < html.length; j++) {
    const ch = html[j];
    if (ch === '"') {
      j += 1;
      while (j < html.length && html[j] !== '"') {
        if (html[j] === "\\") j += 1;
        j += 1;
      }
    } else if (ch === "[") {
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, j + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseCues(raw: string): Cue[] {
  if (!raw) return [];
  if (raw.startsWith("{")) {
    try {
      const data = JSON.parse(raw);
      return (data.events ?? [])
        .filter((e: any) => e.segs)
        .map((e: any) => ({
          start: e.tStartMs / 1000,
          end: (e.tStartMs + (e.dDurationMs ?? 2000)) / 1000,
          text: e.segs
            .map((s: any) => s.utf8 ?? "")
            .join("")
            .replace(/\n/g, " ")
            .trim(),
        }))
        .filter((c: Cue) => c.text.length > 0);
    } catch {
      return [];
    }
  }
  if (raw.startsWith("<")) {
    const cues: Cue[] = [];
    const re =
      /<text[^>]*start="([\d.]+)"[^>]*?(?:dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const start = parseFloat(m[1]);
      const dur = m[2] ? parseFloat(m[2]) : 2;
      const text = decodeEntities(m[3])
        .replace(/<[^>]+>/g, "")
        .replace(/\n/g, " ")
        .trim();
      if (text) cues.push({ start, end: start + dur, text });
    }
    return cues;
  }
  return [];
}

/** 트랙 선택: 요청 언어 우선, 없으면 영어 → 첫 트랙 (비한국어는 Groq 번역) */
function pickTrack(
  tracks: CaptionTrack[],
  lang: string,
): CaptionTrack | undefined {
  return (
    tracks.find((t) => t.languageCode === lang && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode === lang) ??
    tracks.find((t) => t.languageCode === "en") ??
    tracks[0]
  );
}

async function cuesFromYoutube(
  videoId: string,
  lang: string,
  dbg: Record<string, unknown>,
): Promise<{ cues: Cue[]; needTranslate: boolean }> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=ko`, {
    headers: { "user-agent": UA, "accept-language": "ko,en;q=0.8" },
    cache: "no-store",
  });
  const html = await res.text();
  const tracks = extractCaptionTracks(html) ?? [];
  dbg.trackLangs = tracks.map(
    (t) => `${t.languageCode}${t.kind === "asr" ? "(auto)" : ""}`,
  );

  const track = pickTrack(tracks, lang);
  if (!track) return { cues: [], needTranslate: false };

  const base = track.baseUrl.replace(/\\u0026/g, "&");
  const sub = await fetch(`${base}&fmt=json3`, {
    headers: { "user-agent": UA },
    cache: "no-store",
  });
  dbg.timedtextStatus = sub.status;
  const raw = (await sub.text()).trim();
  return {
    cues: parseCues(raw),
    needTranslate: track.languageCode !== lang,
  };
}

/* ──────────────── Groq 번역 ──────────────── */

async function translateCues(
  cues: Cue[],
  dbg: Record<string, unknown>,
): Promise<Cue[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return cues;

  const groq = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const CHUNK = 60;
  const result: Cue[] = [];

  for (let i = 0; i < cues.length; i += CHUNK) {
    const chunk = cues.slice(i, i + CHUNK);
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a subtitle translator. Translate each subtitle line into natural Korean. " +
              "Return ONLY a JSON array of strings with exactly the same number of items, same order. No extra text.",
          },
          { role: "user", content: JSON.stringify(chunk.map((c) => c.text)) },
        ],
      });
      const text = completion.choices[0]?.message?.content ?? "[]";
      const translated: string[] = JSON.parse(
        text.slice(text.indexOf("["), text.lastIndexOf("]") + 1),
      );
      chunk.forEach((c, idx) =>
        result.push({ ...c, text: translated[idx] ?? c.text }),
      );
    } catch (e) {
      dbg.translateError = String(e);
      result.push(...chunk);
    }
  }
  return result;
}

/* ──────────────── 핸들러 ──────────────── */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("v");
  const lang = searchParams.get("lang") ?? "ko";
  const debug = searchParams.get("debug") === "1";

  if (!videoId || !/^[\w-]{5,20}$/.test(videoId)) {
    return NextResponse.json({ cues: [], source: "invalid" }, { status: 400 });
  }

  const cacheKey = `v4:${videoId}:${lang}`;
  const hit = cache.get(cacheKey);
  if (!debug && hit && Date.now() - hit.ts < CACHE_TTL) {
    return NextResponse.json({ cues: hit.cues, source: hit.source });
  }

  const dbg: Record<string, unknown> = {};
  let source = "none";
  let cues: Cue[] = [];

  // 1) 로컬 자막 파일 (주요 작품 — 풀 커스텀 보장)
  cues = await cuesFromLocalFile(videoId);
  if (cues.length > 0) source = "local";

  // 2) 유튜브 timedtext (현재 대부분 429 차단이지만 시도)
  if (cues.length === 0) {
    try {
      const yt = await cuesFromYoutube(videoId, lang, dbg);
      if (yt.cues.length > 0) {
        cues = yt.needTranslate ? await translateCues(yt.cues, dbg) : yt.cues;
        source = yt.needTranslate ? "youtube-translated" : "youtube";
      }
    } catch (e) {
      dbg.youtubeError = String(e);
    }
  }

  if (cues.length > 0) cache.set(cacheKey, { cues, source, ts: Date.now() });

  return NextResponse.json(
    debug
      ? { cues: cues.slice(0, 5), cueCount: cues.length, source, debug: dbg }
      : { cues, source },
  );
}
