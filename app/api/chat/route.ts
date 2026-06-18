import OpenAI from "openai";

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

const SYSTEM_PROMPT = `당신은 넷플릭스 스타일 OTT 서비스의 AI 어시스턴트 "Netflix AI"입니다.
사용자가 원하는 영화나 시리즈를 찾을 수 있도록 도와주는 역할을 합니다.

역할:
- 사용자의 취향, 기분, 상황에 맞는 콘텐츠를 추천합니다
- 특정 장르, 분위기, 특징을 가진 작품을 탐색해줍니다
- 비슷한 작품을 찾아줍니다

답변 규칙:
- 반드시 한국어로 답변합니다
- 친근하고 간결한 톤을 유지합니다
- 추천 작품은 번호 목록 형식으로 제시합니다
- 각 작품 제목은 반드시 [[제목]] 형식으로 감싸서 표시합니다 (예: [[기생충]], [[브레이킹 배드]])
- 각 작품에 제목, 간단한 추천 이유, 장르를 포함합니다
- 답변은 최대 5개 작품으로 제한합니다
- 실제로 존재하는 작품만 추천합니다
- 절대로 URL, 링크, 웹사이트 주소를 제공하지 않습니다`;

type Message = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const { messages }: { messages: Message[] } = await req.json();
    const groq = getGroqClient();

    const stream = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: true,
      max_tokens: 800,
      temperature: 0.8,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    console.error("[CONNECT AI] 오류:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}

export async function GET() {
  try {
    const groq = getGroqClient();
    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: "안녕" }],
      max_tokens: 10,
    });
    return Response.json({ ok: true, test: result.choices[0].message.content });
  } catch (e) {
    console.error("[CONNECT AI] 연결 테스트 실패:", e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
