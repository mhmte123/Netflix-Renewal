"use client";

interface StartScreenProps {
  onStart: () => void;
}

/** 게임 최초 진입 화면 */
export default function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className="game-overlay game-start">
      <p className="game-start__eyebrow">K-POP DEMON HUNTERS</p>
      <h1 className="game-start__logo">
        RUN WITH <span>RUMI</span>
      </h1>
      <p className="game-start__desc">
        악령을 피해 달리며
        <br />
        최대한 높은 점수를 획득하세요.
      </p>
      <div className="game-start__keys">
        <span className="game-start__key">SPACE</span>
        <span className="game-start__key">↑</span>
        <span className="game-start__key game-start__key--touch">TOUCH</span>
        <em>점프</em>
      </div>
      <button type="button" className="game-btn game-btn--primary" onClick={onStart}>
        START GAME
      </button>
    </div>
  );
}
