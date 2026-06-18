"use client";

/**
 * WebAudio 기반 사운드 매니저 (오디오 파일 없이 신디사이저로 생성)
 * - 효과음: 점프 / 아이템 획득 / 충돌 / 게임오버
 * - 배경음: 경쾌한 K-POP 스타일 아르페지오 루프
 * - 전역 음소거 토글 지원
 */
class GameSound {
  private ctx: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  muted = false;

  private getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** 단일 톤 재생 헬퍼 */
  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = "square",
    volume = 0.06,
    slideTo?: number,
  ) {
    if (this.muted) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        slideTo,
        ctx.currentTime + duration,
      );
    }
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  jump() {
    this.tone(320, 0.18, "square", 0.05, 660);
  }

  pickup() {
    this.tone(880, 0.08, "triangle", 0.07);
    setTimeout(() => this.tone(1320, 0.12, "triangle", 0.07), 70);
  }

  power() {
    this.tone(523, 0.1, "sawtooth", 0.05);
    setTimeout(() => this.tone(784, 0.1, "sawtooth", 0.05), 90);
    setTimeout(() => this.tone(1046, 0.22, "sawtooth", 0.06), 180);
  }

  crash() {
    this.tone(180, 0.3, "sawtooth", 0.09, 50);
  }

  gameOver() {
    this.tone(440, 0.18, "square", 0.06, 330);
    setTimeout(() => this.tone(330, 0.18, "square", 0.06, 220), 180);
    setTimeout(() => this.tone(220, 0.5, "square", 0.07, 110), 360);
  }

  startBgm() {
    if (typeof window === "undefined") return;
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio("/images/game/Takedown.mp3.mpeg");
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = 0.5;
    }
    this.bgmAudio.muted = this.muted;
    if (!this.bgmAudio.paused) return;
    void this.bgmAudio.play();
  }

  stopBgm() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.bgmAudio) this.bgmAudio.muted = muted;
  }
}

/** 싱글톤 인스턴스 */
export const gameSound = new GameSound();
