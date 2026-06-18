"use client";

import { useState } from "react";
import { seedDummyUsers } from "@/lib/seedDummyUsers";
import { showToast } from "@/store/useToastStore";

export default function SeedDummiesPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: number; errors: string[] } | null>(null);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await seedDummyUsers();
      setResult(r);
      showToast(
        r.failed === 0
          ? `더미 유저 ${r.ok}명을 Firestore에 심었어요.`
          : `완료: 성공 ${r.ok} · 실패 ${r.failed}`,
      );
    } catch (e) {
      showToast("시드 중 오류가 발생했어요. 콘솔을 확인해주세요.");
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "120px auto", padding: "0 24px", color: "#fff" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>더미 유저 시드</h1>
      <p style={{ color: "#b3b3b3", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
        더미 플레이리스트의 제작자들을 실제 Firestore 유저(<code>users/dummy-N</code>)와
        플레이리스트(<code>playlists/dummy-N</code>)로 생성합니다. 여러 번 눌러도 안전합니다.
      </p>

      <button
        type="button"
        onClick={run}
        disabled={running}
        style={{
          padding: "12px 22px",
          borderRadius: 8,
          border: 0,
          background: running ? "#5a5a5a" : "#e50914",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          cursor: running ? "default" : "pointer",
        }}
      >
        {running ? "심는 중..." : "더미 유저 심기"}
      </button>

      {result && (
        <div style={{ marginTop: 24, fontSize: 14 }}>
          <p>성공: {result.ok}명 · 실패: {result.failed}명</p>
          {result.errors.length > 0 && (
            <ul style={{ marginTop: 10, color: "#ff8a8a", lineHeight: 1.6 }}>
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p style={{ marginTop: 28, color: "#777", fontSize: 12, lineHeight: 1.6 }}>
        권한 오류(permission-denied)가 뜨면 Firestore 규칙이 다른 유저 문서 쓰기를 막고 있는 것이라,
        시드 동안만 규칙을 열거나 관리자 환경에서 실행해야 합니다.
      </p>
    </div>
  );
}
