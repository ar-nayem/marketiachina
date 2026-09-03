// Emoji Burst button effect - fires a burst of emojis from an element's
// center under simple gravity physics, plus a small springy shake on the
// element itself. Rebuilt in-house to match Originkit's "Emoji Burst"
// component spec (https://www.originkit.dev - full source is gated behind
// their account sign-in, so this is a from-scratch reimplementation of the
// documented behavior/props rather than a copy of their code) and styled to
// sit invisibly on top of our own themed buttons rather than carrying its
// own button chrome.

const DEFAULT_EMOJIS = ['🎉', '✨', '😄', '🔥', '💥', '⭐', '💖', '🤩', '👍', '🥳', '🎊', '😎'];

let burstLayer = null;
function getBurstLayer() {
  if (!burstLayer || !document.body.contains(burstLayer)) {
    burstLayer = document.createElement('div');
    burstLayer.id = 'emoji-burst-layer';
    burstLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10000;overflow:hidden;';
    document.body.appendChild(burstLayer);
  }
  return burstLayer;
}

/**
 * @param {HTMLElement} targetEl - element the burst launches from (its center).
 * @param {object} [opts]
 * @param {string[]} [opts.emojis] - comma-set of emojis picked at random per particle.
 * @param {number} [opts.emojiSize] - px size of each flying emoji.
 * @param {number} [opts.burstCount] - particles launched per burst.
 * @param {number} [opts.power] - launch speed.
 * @param {number} [opts.spread] - angular spread of the launch cone, in degrees.
 * @param {number} [opts.gravity] - downward pull strength.
 * @param {number} [opts.shakeIntensity] - px the target jolts on press.
 */
export function fireEmojiBurst(targetEl, opts = {}) {
  if (!targetEl) return;
  const {
    emojis = DEFAULT_EMOJIS,
    emojiSize = 20,
    burstCount = 16,
    power = 12,
    spread = 55,
    gravity = 4,
    shakeIntensity = 6,
  } = opts;

  if (shakeIntensity > 0) {
    targetEl.style.transition = 'transform 0.18s cubic-bezier(.36,.07,.19,.97)';
    targetEl.style.transform = `translateY(${shakeIntensity}px)`;
    requestAnimationFrame(() => {
      targetEl.style.transform = '';
      setTimeout(() => { targetEl.style.transition = ''; }, 200);
    });
  }

  const rect = targetEl.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const layer = getBurstLayer();

  for (let i = 0; i < burstCount; i++) {
    const particle = document.createElement('span');
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    particle.style.cssText = `position:absolute;left:${originX}px;top:${originY}px;font-size:${emojiSize}px;line-height:1;will-change:transform,opacity;`;
    layer.appendChild(particle);

    const angleDeg = -90 + (Math.random() - 0.5) * spread;
    const angle = angleDeg * (Math.PI / 180);
    const speed = power * (0.65 + Math.random() * 0.7);
    const vx0 = Math.cos(angle) * speed;
    const vy0 = Math.sin(angle) * speed;
    const spin = (Math.random() - 0.5) * 6;
    const maxLife = 55 + Math.random() * 25;

    let frame = 0;
    (function animate() {
      frame++;
      const t = frame;
      const x = vx0 * t;
      const y = vy0 * t + 0.5 * gravity * 0.06 * t * t;
      const opacity = Math.max(0, 1 - frame / maxLife);
      particle.style.transform = `translate(${x}px, ${y}px) rotate(${spin * t}deg)`;
      particle.style.opacity = String(opacity);
      if (frame < maxLife) {
        requestAnimationFrame(animate);
      } else {
        particle.remove();
      }
    })();
  }
}
