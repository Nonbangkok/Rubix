"use client";

const SOUND_PATHS = {
  transition: "/sounds/transition.wav",
  ui: "/sounds/sound.wav",
} as const;

type SoundKey = keyof typeof SOUND_PATHS;

class AudioController {
  private cache: Map<SoundKey, HTMLAudioElement> = new Map();

  play(key: SoundKey) {
    if (typeof window === "undefined") return;

    let audio = this.cache.get(key);
    if (!audio) {
      audio = new Audio(SOUND_PATHS[key]);
      this.cache.set(key, audio);
    }

    // Reset to start if already playing
    audio.currentTime = 0;
    audio.play().catch((err) => {
      // Browsers often block auto-play until user interaction
      console.warn(`Audio play failed for ${key}:`, err);
    });
  }
}

export const soundManager = new AudioController();
