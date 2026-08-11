export function playNotificationSound() {
  try {
    // Create a simple ding sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Create oscillators for a pleasant ding sound
    const now = audioContext.currentTime
    const duration = 0.3
    
    // Main ding tone (400 Hz)
    const osc1 = audioContext.createOscillator()
    const gain1 = audioContext.createGain()
    
    osc1.frequency.value = 800
    osc1.type = "sine"
    
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + duration)
    
    osc1.connect(gain1)
    gain1.connect(audioContext.destination)
    
    osc1.start(now)
    osc1.stop(now + duration)
    
    // Secondary harmonic (1200 Hz for richness)
    const osc2 = audioContext.createOscillator()
    const gain2 = audioContext.createGain()
    
    osc2.frequency.value = 1200
    osc2.type = "sine"
    
    gain2.gain.setValueAtTime(0.2, now)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + duration)
    
    osc2.connect(gain2)
    gain2.connect(audioContext.destination)
    
    osc2.start(now)
    osc2.stop(now + duration)
  } catch (error) {
    console.error("[v0] Failed to play notification sound:", error)
  }
}

export function getGroupStatusColor(submitted: boolean): string {
  return submitted ? "bg-green-500" : "bg-red-500"
}

export function getGroupStatusLabel(submitted: boolean): string {
  return submitted ? "Đã nộp" : "Chưa nộp"
}
