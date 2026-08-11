// Âm thanh tùy chọn, dùng Web Audio API (không cần file mp3)
const KEY = "tln_sounds_enabled"

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(KEY) !== "0"
}
export function setSoundEnabled(v: boolean) {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, v ? "1" : "0")
}

let ctx: AudioContext | null = null
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!isSoundEnabled()) return null
  if (!ctx) {
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
      ctx = new AC()
    } catch {
      return null
    }
  }
  return ctx
}

function tone(freq: number, durationMs: number, when = 0, type: OscillatorType = "sine", gain = 0.12) {
  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime + when
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + durationMs / 1000 + 0.05)
}

export const sounds = {
  tick() {
    tone(880, 60, 0, "square", 0.06)
  },
  success() {
    tone(523, 120, 0)
    tone(784, 200, 0.1)
  },
  newSubmission() {
    tone(659, 100, 0, "triangle", 0.1)
    tone(880, 140, 0.08, "triangle", 0.1)
  },
  timeUp() {
    tone(440, 200, 0, "sawtooth", 0.15)
    tone(330, 300, 0.2, "sawtooth", 0.15)
  },
}
