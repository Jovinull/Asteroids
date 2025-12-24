import type { Settings } from "./types";
import { clamp, safePlay } from "./utils";
import { FPS } from "./constants";

export class Sound {
  private streamNum = 0;
  private streams: HTMLAudioElement[] = [];

  constructor(
    private src: string,
    private settings: Settings,
    private maxStreams = 1,
    private baseVol = 1.0
  ) {
    for (let i = 0; i < maxStreams; i++) {
      const a = new Audio(src);
      a.volume = clamp(baseVol * settings.sfxVolume, 0, 1);
      this.streams.push(a);
    }
  }

  play(): void {
    if (!this.settings.sfxOn) return;
    this.streamNum = (this.streamNum + 1) % this.maxStreams;
    const a = this.streams[this.streamNum];
    a.volume = clamp(this.baseVol * this.settings.sfxVolume, 0, 1);
    safePlay(a);
  }

  stop(): void {
    const a = this.streams[this.streamNum];
    a.pause();
    a.currentTime = 0;
  }
}

export class Music {
  private soundLow: HTMLAudioElement;
  private soundHigh: HTMLAudioElement;
  private low = true;
  private tempo = 1.0;
  private beatTime = 0;

  constructor(srcLow: string, srcHigh: string, private settings: Settings) {
    this.soundLow = new Audio(srcLow);
    this.soundHigh = new Audio(srcHigh);
  }

  syncVol(): void {
    const v = clamp(this.settings.musicVolume, 0, 1);
    this.soundLow.volume = this.settings.musicOn ? v : 0;
    this.soundHigh.volume = this.settings.musicOn ? v : 0;
  }

  play(): void {
    if (!this.settings.musicOn) return;
    this.syncVol();
    const a = this.low ? this.soundLow : this.soundHigh;
    safePlay(a);
    this.low = !this.low;
  }

  tick(musicReady: boolean): void {
    if (!musicReady) return;
    if (this.beatTime === 0) {
      this.play();
      this.beatTime = Math.ceil(this.tempo * FPS);
    } else {
      this.beatTime--;
    }
  }

  setAsteroidRatio(ratio: number): void {
    this.tempo = 1.0 - 0.75 * (1.0 - ratio);
  }
}

export type AudioSystem = {
  fxExplode: Sound;
  fxHit: Sound;
  fxLaser: Sound;
  fxThrust: Sound;
  fxPower: Sound;
  fxUfoHit: Sound;
  music: Music;
  ufoSiren: HTMLAudioElement;
  syncAllVolumes: () => void;
};

export function createAudioSystem(settings: Settings): AudioSystem {
  const fxExplode = new Sound("sounds/explode.m4a", settings, 2, 0.9);
  const fxHit = new Sound("sounds/hit.m4a", settings, 6, 0.75);
  const fxLaser = new Sound("sounds/laser.m4a", settings, 6, 0.55);
  const fxThrust = new Sound("sounds/thrust.m4a", settings, 1, 0.35);
  const fxPower = new Sound("sounds/power.m4a", settings, 2, 0.7);
  const fxUfoHit = new Sound("sounds/ufo_hit.m4a", settings, 2, 0.8);

  const music = new Music("sounds/music-low.m4a", "sounds/music-high.m4a", settings);

  const ufoSiren = new Audio("sounds/siren.m4a");
  ufoSiren.loop = true;

  function syncAllVolumes(): void {
    music.syncVol();
    ufoSiren.volume = settings.sfxOn ? clamp(0.28 * settings.sfxVolume, 0, 1) : 0;
  }

  return {
    fxExplode,
    fxHit,
    fxLaser,
    fxThrust,
    fxPower,
    fxUfoHit,
    music,
    ufoSiren,
    syncAllVolumes,
  };
}
