// Confetti mini không phụ thuộc vào package ngoài
export function fireConfetti(opts: { duration?: number; colors?: string[] } = {}) {
  if (typeof window === "undefined") return
  const duration = opts.duration ?? 1200
  const colors = opts.colors ?? ["#0b8a8f", "#d49a3c", "#4fb3b3", "#e2ac4e", "#1d6e73"]

  const root = document.createElement("div")
  root.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;"
  document.body.appendChild(root)

  const count = 60
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div")
    const size = 6 + Math.random() * 8
    const color = colors[Math.floor(Math.random() * colors.length)]
    const left = 50 + (Math.random() - 0.5) * 40 // center spread
    const rot = Math.random() * 720 - 360
    const tx = (Math.random() - 0.5) * 480
    const ty = -400 - Math.random() * 300
    el.style.cssText = `
      position:absolute;top:60%;left:${left}%;width:${size}px;height:${size * 0.6}px;
      background:${color};border-radius:2px;
      transform:translate(-50%,-50%);opacity:0;
      transition:transform ${duration}ms cubic-bezier(0.1,.9,.3,1), opacity ${duration}ms ease-out;
      will-change:transform,opacity;
    `
    root.appendChild(el)
    requestAnimationFrame(() => {
      el.style.opacity = "1"
      el.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${rot}deg)`
    })
    setTimeout(() => {
      el.style.opacity = "0"
    }, duration * 0.7)
  }
  setTimeout(() => root.remove(), duration + 300)
}
