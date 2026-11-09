/* =====================================================================
   AFIANZAGROUP · script.js
   JavaScript sin dependencias: si algo falla, la página sigue completa.
   Módulos: configuración · cargador · encabezado · hero 3D (canvas) · cinta
            manifiesto · servicios · ruta del contrato · perfiles · cine
            revelado · tarjetas · horario en vivo · formulario · WhatsApp
   ===================================================================== */
(() => {
  'use strict';

  /* ---------- CONFIGURACIÓN ---------- */
  // Número de WhatsApp del negocio: código de país + 10 dígitos, solo números.
  // Mientras esté vacío, el botón flotante y el envío por WhatsApp quedan ocultos.
  const WHATSAPP_NUMBER = '';
  const NOMBRE_NEGOCIO = 'Afianzagroup';
  const ZONA_HORARIA = 'America/Mexico_City';
  // Horario de atención en minutos desde las 00:00 (1 = lunes ... 5 = viernes)
  const HORARIO = {
    1: [525, 1080],
    2: [525, 1080],
    3: [525, 1080],
    4: [525, 1080],
    5: [525, 900],
  };
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  /* ---------- UTILIDADES ---------- */
  const $ = (selector, ctx = document) => ctx.querySelector(selector);
  const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !reduceMotion;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Estas clases activan los efectos de scroll solo cuando el JS ya está funcionando
  if (motion) root.classList.add('motion', 'reveal-on');

  /* Estado compartido del scroll */
  const S = { y: 0, vh: window.innerHeight, vw: window.innerWidth, heroP: 0 };
  const updaters = [];
  let queued = false;

  function requestUpdate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(runUpdaters);
  }

  function runUpdaters() {
    queued = false;
    S.y = window.pageYOffset || root.scrollTop || 0;
    S.vh = window.innerHeight;
    S.vw = window.innerWidth;
    for (let i = 0; i < updaters.length; i += 1) updaters[i](S);
  }

  /* ---------- IMÁGENES: si una falla, se oculta y queda el fondo de respaldo ---------- */
  function initImages() {
    $$('img').forEach((img) => {
      img.addEventListener('error', () => img.classList.add('is-broken'));
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) img.classList.add('is-broken');
    });
  }

  /* ---------- CARGADOR ---------- */
  function initLoader() {
    const loader = $('#cargador');
    if (!loader) return;
    const countEl = $('[data-count]', loader);
    const barEl = $('[data-bar]', loader);
    const total = motion ? 1500 : 450;
    const t0 = performance.now();
    let opened = false;

    function open() {
      if (opened) return;
      opened = true;
      loader.classList.add('is-open');
      setTimeout(() => {
        loader.style.display = 'none';
        loader.setAttribute('aria-hidden', 'true');
      }, 650);
    }

    function frame(now) {
      const t = clamp((now - t0) / total);
      const v = easeOut(t);
      if (countEl) countEl.textContent = String(Math.round(v * 100));
      if (barEl) barEl.style.transform = 'scaleX(' + v.toFixed(3) + ')';
      if (t < 1) requestAnimationFrame(frame);
      else setTimeout(open, 110);
    }

    requestAnimationFrame(frame);
    setTimeout(open, 1700); // respaldo: por si el navegador pausa las animaciones
  }

  /* ---------- ENCABEZADO, MENÚ, PROGRESO Y NAVEGACIÓN ACTIVA ---------- */
  function initChrome() {
    const header = $('#header');
    const burger = $('#burger');
    const menu = $('#menu');
    const bar = $('#progreso');
    const floatCta = $('#cta-flotante');
    const hero = $('#inicio');
    const contact = $('#contacto');

    function closeMenu() {
      root.classList.remove('menu-open');
      if (burger) {
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Abrir menú');
      }
    }

    if (burger && menu) {
      burger.addEventListener('click', () => {
        const open = root.classList.toggle('menu-open');
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      });
      $$('a', menu).forEach((a) => a.addEventListener('click', closeMenu));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
      });
      const mq = window.matchMedia('(min-width: 900px)');
      const onMq = (e) => {
        if (e.matches) closeMenu();
      };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }

    const navLinks = $$('.nav__list a').map((a) => ({ a, section: $(a.getAttribute('href')) })).filter((x) => x.section);

    updaters.push((s) => {
      if (header) header.classList.toggle('is-scrolled', s.y > 24);
      if (bar) {
        const max = Math.max(1, root.scrollHeight - s.vh);
        bar.style.transform = 'scaleX(' + clamp(s.y / max).toFixed(4) + ')';
      }
      if (floatCta && hero && contact) {
        const inContact = contact.getBoundingClientRect().top < s.vh * 0.55;
        floatCta.classList.toggle('is-visible', s.y > hero.offsetHeight * 0.7 && !inContact);
      }
      const line = s.vh * 0.4;
      navLinks.forEach(({ a, section }) => {
        const r = section.getBoundingClientRect();
        const current = r.top <= line && r.bottom > line;
        if (current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }

  /* ---------- HERO: geometría 3D del logo en canvas ---------- */
  function initHero() {
    const hero = $('#inicio');
    const canvas = $('#hero-canvas');
    if (!hero || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    updaters.push((s) => {
      const p = clamp(s.y / (hero.offsetHeight * 0.9));
      s.heroP = p;
      hero.style.setProperty('--hp', p.toFixed(3));
    });

    const TAU = Math.PI * 2;
    const S2 = Math.SQRT2;
    const S3 = Math.sqrt(3);
    const S6 = Math.sqrt(6);
    const desktopMq = window.matchMedia('(min-width: 900px)');

    // Cubo (8 vértices) + estrella octángula (2 tetraedros) + octaedro interior.
    // Visto por la diagonal (1,1,1) forma el hexágono con hexagrama del logo.
    const cube = [];
    [-1, 1].forEach((x) => [-1, 1].forEach((y) => [-1, 1].forEach((z) => cube.push([x, y, z]))));
    const octa = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const pts = cube.concat(octa);
    const cubeEdges = [];
    const tetraEdges = [];
    for (let i = 0; i < 8; i += 1) {
      for (let j = i + 1; j < 8; j += 1) {
        let diff = 0;
        for (let k = 0; k < 3; k += 1) if (cube[i][k] !== cube[j][k]) diff += 1;
        if (diff === 1) cubeEdges.push([i, j]);
        else if (diff === 2) tetraEdges.push([i, j]);
      }
    }
    const octaEdges = [];
    for (let i = 0; i < 6; i += 1) {
      for (let j = i + 1; j < 6; j += 1) {
        const a = octa[i];
        const b = octa[j];
        if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] === 0) octaEdges.push([i + 8, j + 8]);
      }
    }
    const pulseEdges = cubeEdges.concat(tetraEdges);
    const px = new Float32Array(14);
    const py = new Float32Array(14);
    const pd = new Float32Array(14);

    let w = 0;
    let h = 0;
    let dpr = 1;
    let cx = 0;
    let cy = 0;
    let R = 100;
    const particles = [];

    function seedParticles(n) {
      particles.length = 0;
      for (let i = 0; i < n; i += 1) {
        particles.push({
          x: Math.random(),
          y: Math.random(),
          z: Math.random(),
          sx: 0,
          sy: 0,
          s: 0.4 + Math.random() * 1.6,
          vx: (Math.random() - 0.5) * 0.014,
          vy: -(0.01 + Math.random() * 0.03),
          ph: Math.random() * TAU,
          tw: 0.6 + Math.random() * 1.6,
        });
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      w = Math.max(1, Math.round(hero.clientWidth * dpr));
      h = Math.max(1, Math.round(hero.clientHeight * dpr));
      canvas.width = w;
      canvas.height = h;
      if (desktopMq.matches) {
        cx = w * 0.69;
        cy = h * 0.5;
        R = Math.min(h * 0.33, w * 0.24);
        seedParticles(120);
      } else {
        const header = 68 * dpr;
        cx = w * 0.5;
        cy = header + 135 * dpr;
        R = Math.min(w * 0.3, 122 * dpr);
        seedParticles(56);
      }
    }

    function project(theta, phi, size) {
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      for (let i = 0; i < 14; i += 1) {
        const v = pts[i];
        const x = (v[0] - v[1]) / S2;
        const y = -(v[0] + v[1] - 2 * v[2]) / S6;
        const z = (v[0] + v[1] + v[2]) / S3;
        const x1 = x * ct + z * st;
        const z1 = -x * st + z * ct;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const persp = 1 / (1 - z2 * 0.11);
        px[i] = cx + x1 * size * persp;
        py[i] = cy + y2 * size * persp;
        pd[i] = clamp((z2 + 1.8) / 3.6);
      }
    }

    function goldFor(d, alpha) {
      const r = Math.round(lerp(150, 251, d));
      const g = Math.round(lerp(112, 232, d));
      const b = Math.round(lerp(28, 160, d));
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
    }

    function drawEdges(list, width, alphaMul, glow) {
      for (let k = 0; k < list.length; k += 1) {
        const a = list[k][0];
        const b = list[k][1];
        const d = (pd[a] + pd[b]) * 0.5;
        ctx.beginPath();
        ctx.moveTo(px[a], py[a]);
        ctx.lineTo(px[b], py[b]);
        if (glow) {
          ctx.lineWidth = width * 5 * dpr;
          ctx.strokeStyle = 'rgba(226,189,75,' + (0.05 * alphaMul * (0.4 + d)).toFixed(3) + ')';
          ctx.stroke();
        }
        ctx.lineWidth = width * (0.7 + d * 0.9) * dpr;
        ctx.strokeStyle = goldFor(d, (0.28 + 0.62 * d) * alphaMul);
        ctx.stroke();
      }
    }

    function drawOrbit(t, rx, ry, rot, speed, phase, dash, alpha) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.setLineDash([dash * dpr, dash * 1.6 * dpr]);
      ctx.lineDashOffset = -t * 14 * dpr;
      ctx.lineWidth = dpr;
      ctx.strokeStyle = 'rgba(226,189,75,' + alpha + ')';
      ctx.stroke();
      ctx.setLineDash([]);
      const a = t * speed + phase;
      const sx = Math.cos(a) * rx;
      const sy = Math.sin(a) * ry;
      ctx.beginPath();
      ctx.arc(sx, sy, 5 * dpr, 0, TAU);
      ctx.fillStyle = 'rgba(241,215,122,0.18)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2 * dpr, 0, TAU);
      ctx.fillStyle = 'rgba(255,244,196,0.95)';
      ctx.fill();
      ctx.restore();
    }

    let pointerX = 0;
    let pointerY = 0;
    let mx = 0;
    let my = 0;

    function render(t, dt) {
      mx = lerp(mx, pointerX, 0.05);
      my = lerp(my, pointerY, 0.05);
      const p = S.heroP;
      const tt = t - 1.9; // a los 1.9 s la figura coincide con el logo
      const theta = tt * 0.26 + p * 2.4 + mx * 0.6;
      const phi = Math.sin(t * 0.37) * 0.16 + my * 0.45 + p * 0.3;
      const align = Math.pow(Math.max(0, Math.cos(2 * tt * 0.26)), 10);
      const size = (R / 1.633) * (1 + p * 0.28);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(1 - p * 0.8);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Resplandor central que late al alinearse con el logo
      const gr = R * (1.7 + align * 0.35);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
      grad.addColorStop(0, 'rgba(241,215,122,' + (0.2 + align * 0.18).toFixed(3) + ')');
      grad.addColorStop(0.5, 'rgba(226,189,75,0.06)');
      grad.addColorStop(1, 'rgba(226,189,75,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);

      // Partículas y red de puntos
      for (let i = 0; i < particles.length; i += 1) {
        const q = particles[i];
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        if (q.y < -0.03) q.y = 1.03;
        if (q.x < -0.03) q.x = 1.03;
        if (q.x > 1.03) q.x = -0.03;
        const par = q.z - 0.5;
        q.sx = q.x * w + mx * par * 46 * dpr;
        q.sy = q.y * h + my * par * 32 * dpr;
        const tw = 0.5 + 0.5 * Math.sin(t * q.tw + q.ph);
        const alpha = (0.14 + 0.5 * q.z) * (0.35 + 0.65 * tw);
        ctx.beginPath();
        ctx.arc(q.sx, q.sy, (0.6 + q.s * q.z * 1.3) * dpr, 0, TAU);
        ctx.fillStyle = 'rgba(241,215,122,' + alpha.toFixed(3) + ')';
        ctx.fill();
      }
      const link = 92 * dpr;
      const linkCount = Math.min(particles.length, 64);
      ctx.lineWidth = 0.8 * dpr;
      for (let i = 0; i < linkCount; i += 1) {
        for (let j = i + 1; j < linkCount; j += 1) {
          const dx = particles[i].sx - particles[j].sx;
          const dy = particles[i].sy - particles[j].sy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < link) {
            ctx.strokeStyle = 'rgba(226,189,75,' + ((1 - dist / link) * 0.16).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(particles[i].sx, particles[i].sy);
            ctx.lineTo(particles[j].sx, particles[j].sy);
            ctx.stroke();
          }
        }
      }

      // Anillos y órbitas
      ctx.setLineDash([3 * dpr, 7 * dpr]);
      ctx.lineDashOffset = t * 6 * dpr;
      ctx.lineWidth = dpr;
      ctx.strokeStyle = 'rgba(226,189,75,0.2)';
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.22, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(226,189,75,0.1)';
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.5, 0, TAU);
      ctx.stroke();
      drawOrbit(t, R * 1.55, R * 0.46, t * 0.05 + 0.4, 0.7, 0, 4, 0.28);
      drawOrbit(t, R * 1.3, R * 0.34, -t * 0.04 - 0.7, -0.9, 2, 3, 0.2);

      // Sólido 3D
      project(theta, phi, size);
      drawEdges(octaEdges, 0.8, 0.55, false);
      drawEdges(cubeEdges, 1.25, 1, true);
      drawEdges(tetraEdges, 1.1, 0.9, true);

      // Pulsos de luz que recorren las aristas
      for (let k = 0; k < pulseEdges.length; k += 1) {
        const e = pulseEdges[k];
        const ph = (t * 0.28 + k * 0.173) % 1;
        const x = lerp(px[e[0]], px[e[1]], ph);
        const y = lerp(py[e[0]], py[e[1]], ph);
        const a = Math.sin(Math.PI * ph);
        ctx.beginPath();
        ctx.arc(x, y, 5 * dpr, 0, TAU);
        ctx.fillStyle = 'rgba(241,215,122,' + (0.16 * a).toFixed(3) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 1.8 * dpr, 0, TAU);
        ctx.fillStyle = 'rgba(255,246,208,' + (0.95 * a).toFixed(3) + ')';
        ctx.fill();
      }

      // Vértices
      for (let i = 0; i < 14; i += 1) {
        const d = pd[i];
        const big = i < 8;
        ctx.beginPath();
        ctx.arc(px[i], py[i], (big ? 3.4 : 2.1) * (0.7 + d * 0.7) * dpr, 0, TAU);
        ctx.fillStyle = goldFor(d, big ? 0.95 : 0.7);
        ctx.fill();
        if (big) {
          ctx.beginPath();
          ctx.arc(px[i], py[i], 9 * dpr, 0, TAU);
          ctx.fillStyle = 'rgba(226,189,75,' + (0.07 + 0.08 * d).toFixed(3) + ')';
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    resize();

    let running = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let t = 0;

    function frame(now) {
      raf = 0;
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      render(t, dt);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || !motion) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    if (motion) {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
          visible = entries[0].isIntersecting;
          if (visible && !document.hidden) start();
          else stop();
        }).observe(hero);
      } else {
        start();
      }
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop();
        else if (visible) start();
      });
      if (finePointer) {
        hero.addEventListener('pointermove', (e) => {
          const r = hero.getBoundingClientRect();
          pointerX = (e.clientX - r.left) / r.width - 0.5;
          pointerY = (e.clientY - r.top) / r.height - 0.5;
        });
        hero.addEventListener('pointerleave', () => {
          pointerX = 0;
          pointerY = 0;
        });
      }
      start();
    } else {
      // Sin movimiento: un solo cuadro con la figura alineada con el logo
      t = 1.9;
      render(t, 0);
    }

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        if (!motion) render(t, 0);
      }, 120);
    });
  }

  /* ---------- CINTA EN MOVIMIENTO (acelera con el scroll) ---------- */
  function initMarquee() {
    if (!motion) return;
    const wrap = $('.marquee');
    const rows = $$('[data-marquee]').map((row) => {
      const track = $('.marquee__track', row);
      const set = $('.marquee__set', track);
      return { track, set, dir: Number(row.dataset.dir) || -1, x: 0, w: 0 };
    });
    if (!wrap || !rows.length) return;

    function measure() {
      rows.forEach((r) => {
        r.w = r.set.getBoundingClientRect().width;
        if (r.dir > 0 && r.x === 0) r.x = -r.w * 0.5;
      });
    }
    measure();
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener('load', measure);

    let visible = true;
    let last = performance.now();
    let lastY = window.pageYOffset;
    let vel = 0;

    function loop(now) {
      requestAnimationFrame(loop);
      if (!visible || document.hidden || !rows[0].w) {
        last = now;
        return;
      }
      const dt = Math.min(48, now - last);
      last = now;
      const y = window.pageYOffset;
      vel = lerp(vel, y - lastY, 0.1);
      lastY = y;
      const skew = clamp(vel * -0.3, -7, 7);
      rows.forEach((r) => {
        r.x += r.dir * (0.05 * dt + Math.abs(vel) * 0.55);
        if (r.dir < 0 && r.x <= -r.w) r.x += r.w;
        if (r.dir > 0 && r.x >= 0) r.x -= r.w;
        r.track.style.transform = 'translate3d(' + r.x.toFixed(2) + 'px,0,0) skewX(' + skew.toFixed(2) + 'deg)';
      });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
      }).observe(wrap);
    }
    requestAnimationFrame(loop);
  }

  /* ---------- MANIFIESTO: el texto se enciende palabra por palabra ---------- */
  function splitWords(el) {
    const out = [];
    (function walk(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
            } else {
              const span = document.createElement('span');
              span.className = 'w';
              span.textContent = part;
              frag.appendChild(span);
              out.push(span);
            }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    return out;
  }

  function initManifest() {
    const el = $('[data-scrub]');
    if (!el || !motion) return;
    const words = splitWords(el);
    const cache = new Array(words.length).fill(-1);
    updaters.push((s) => {
      const r = el.getBoundingClientRect();
      const a = s.vh * 0.9;
      const b = s.vh * 0.45 - r.height;
      const p = clamp((a - r.top) / (a - b));
      const k = p * (words.length + 2);
      for (let i = 0; i < words.length; i += 1) {
        const o = 0.14 + 0.86 * clamp(k - i);
        const rounded = Math.round(o * 50);
        if (rounded !== cache[i]) {
          cache[i] = rounded;
          words[i].style.setProperty('--o', (rounded / 50).toFixed(2));
        }
      }
    });
  }

  /* ---------- SERVICIOS: acordeón ---------- */
  function initAccordion() {
    const acc = $('[data-acc]');
    if (!acc) return;
    const aside = $('#svc-aside');
    const items = $$('.acc__item', acc);
    const setRotation = (i) => {
      if (aside) aside.style.setProperty('--rot', i * 60 + 'deg');
    };
    setRotation(0);
    items.forEach((item, i) => {
      const btn = $('.acc__btn', item);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const wasOpen = item.classList.contains('is-open');
        items.forEach((other) => {
          other.classList.remove('is-open');
          const b = $('.acc__btn', other);
          if (b) b.setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          setRotation(i);
        }
      });
    });
  }

  /* ---------- RUTA DEL CONTRATO: sección fijada que construye la obra ---------- */
  function initRoute() {
    const sec = $('[data-route]');
    if (!sec || !motion) return;
    const stages = $$('[data-stage]', sec);
    const rail = $$('.route__rail li', sec);
    const floors = $$('.floor', sec);
    const wins = $$('.win', sec);
    let active = -1;

    updaters.push((s) => {
      const r = sec.getBoundingClientRect();
      const total = r.height - s.vh;
      const p = total > 0 ? clamp(-r.top / total) : 0;

      const build = clamp(p / 0.86);
      const n = floors.length;
      floors.forEach((f, i) => f.style.setProperty('--f', clamp(build * n - i).toFixed(3)));
      wins.forEach((win, i) => win.style.setProperty('--w', clamp(build * n - i - 0.7).toFixed(3)));
      sec.style.setProperty('--s', clamp((p - 0.86) / 0.1).toFixed(3));

      const idx = Math.min(stages.length - 1, Math.floor(p * stages.length));
      rail.forEach((li, i) => li.style.setProperty('--fill', clamp(p * stages.length - i).toFixed(3)));
      if (idx !== active) {
        active = idx;
        stages.forEach((st, i) => st.classList.toggle('is-active', i === idx));
        rail.forEach((li, i) => li.classList.toggle('is-active', i === idx));
      }
    });
  }

  /* ---------- PERFILES: pestañas accesibles ---------- */
  function initTabs() {
    const list = $('[data-tabs]');
    const holder = $('[data-panels]');
    if (!list || !holder) return;
    const tabs = $$('[role="tab"]', list);
    const panels = $$('[role="tabpanel"]', holder);

    function select(i, focus) {
      tabs.forEach((tab, j) => {
        const on = j === i;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        if (panels[j]) panels[j].classList.toggle('is-active', on);
      });
      const tab = tabs[i];
      if (focus) tab.focus({ preventScroll: true });
      if (list.scrollWidth > list.clientWidth + 2) {
        const left = tab.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
        list.scrollTo({ left: left - (list.clientWidth - tab.offsetWidth) / 2, behavior: motion ? 'smooth' : 'auto' });
      }
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i, false));
      tab.addEventListener('keydown', (e) => {
        let next = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        if (next >= 0) {
          e.preventDefault();
          select(next, true);
        }
      });
    });
  }

  /* ---------- CINE: la imagen se abre en pantalla completa ---------- */
  function initCinema() {
    const sec = $('[data-cinema]');
    if (!sec || !motion) return;
    updaters.push((s) => {
      const r = sec.getBoundingClientRect();
      const total = r.height - s.vh;
      const p = total > 0 ? clamp(-r.top / total) : 1;
      sec.style.setProperty('--e', easeOut(clamp(p / 0.55)).toFixed(4));
    });
  }

  /* ---------- REVELADO AL HACER SCROLL ---------- */
  function initReveal() {
    $$('[data-reveal-group], [data-acc]').forEach((group) => {
      Array.from(group.children).forEach((child, i) => child.style.setProperty('--i', i));
    });
    if (!motion) return;
    const items = $$('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        el.classList.add('is-in');
        // Al terminar, se quita el atributo para que el elemento recupere sus propias transiciones
        setTimeout(() => el.removeAttribute('data-reveal'), 2300);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- TARJETAS: luz que sigue al cursor + inclinación 3D ---------- */
  function initCards() {
    if (!finePointer) return;
    $$('.card-fx').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        card.style.setProperty('--mx', x + 'px');
        card.style.setProperty('--my', y + 'px');
        if (motion && !card.hasAttribute('data-reveal')) {
          const rx = (y / r.height - 0.5) * -6;
          const ry = (x / r.width - 0.5) * 6;
          card.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
        }
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
    $$('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * 0.18;
        const y = (e.clientY - (r.top + r.height / 2)) * 0.28;
        btn.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /* ---------- HORARIO EN VIVO (hora de Ciudad de México) ---------- */
  function mxNow() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA_HORARIA,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (type) => {
      const found = parts.find((p) => p.type === type);
      return found ? found.value : '';
    };
    const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: days[get('weekday')], minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
  }

  function formatHour(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h >= 12 ? ' p. m.' : ' a. m.');
  }

  function scheduleInfo() {
    const { day, minutes } = mxNow();
    const today = HORARIO[day];
    if (today && minutes >= today[0] && minutes < today[1]) {
      return { day, open: true, text: 'Abierto ahora · cerramos a las ' + formatHour(today[1]) };
    }
    if (today && minutes < today[0]) {
      return { day, open: false, text: 'Cerrado ahora · hoy abrimos a las ' + formatHour(today[0]) };
    }
    for (let i = 1; i <= 7; i += 1) {
      const d = (day + i) % 7;
      if (HORARIO[d]) {
        const when = i === 1 ? 'mañana' : 'el ' + DIAS[d];
        return { day, open: false, text: 'Cerrado ahora · abrimos ' + when + ' a las ' + formatHour(HORARIO[d][0]) };
      }
    }
    return { day, open: false, text: 'Horario de atención' };
  }

  function initStatus() {
    const badges = $$('[data-status]');
    const rows = $$('[data-days]');
    if (!badges.length) return;
    function paint() {
      try {
        const info = scheduleInfo();
        badges.forEach((badge) => {
          const text = $('.status__text', badge);
          if (text) text.textContent = info.text;
          badge.classList.toggle('is-open', info.open);
        });
        rows.forEach((row) => {
          row.classList.toggle('is-today', row.dataset.days.split(',').indexOf(String(info.day)) !== -1);
        });
      } catch (err) {
        /* Sin Intl o zona horaria: se queda el texto estático del HTML */
      }
    }
    paint();
    setInterval(paint, 60000);
  }

  /* ---------- FORMULARIO → WHATSAPP (o respaldo a Facebook) ---------- */
  function setSelect(select, text) {
    if (!select || !text) return;
    const option = Array.from(select.options).find((o) => o.value === text || o.text === text);
    if (option) select.value = option.value;
  }

  function initForm() {
    const form = $('#form-contacto');
    if (!form) return;
    const nameInput = $('#f-nombre');
    const field = nameInput.closest('.field');
    const err = $('.field__err', field);
    const result = $('#form-result');
    const resultBox = $('#form-result-msg');
    const copyBtn = $('#copiar-mensaje');

    // Los botones de servicios y perfiles preseleccionan el formulario
    $$('[data-servicio]').forEach((a) => a.addEventListener('click', () => setSelect($('#f-tipo'), a.dataset.servicio)));
    $$('[data-perfil]').forEach((a) => a.addEventListener('click', () => setSelect($('#f-perfil'), a.dataset.perfil)));

    function value(name) {
      return ((form.elements[name] && form.elements[name].value) || '').trim();
    }

    function buildMessage() {
      const empresa = value('empresa');
      const lines = ['Hola, soy ' + value('nombre') + (empresa ? ' de ' + empresa : '') + '.'];
      if (value('perfil')) lines.push('Mi perfil: ' + value('perfil') + '.');
      if (value('tipo')) lines.push('Me interesa: ' + value('tipo') + '.');
      if (value('mensaje')) lines.push('Sobre mi caso: ' + value('mensaje'));
      lines.push('Los contacto desde la página web de ' + NOMBRE_NEGOCIO + '. ¿Me pueden orientar con mi cotización?');
      return lines.join('\n');
    }

    nameInput.addEventListener('input', () => {
      if (nameInput.value.trim().length >= 2) {
        field.classList.remove('is-invalid');
        err.hidden = true;
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const valid = nameInput.value.trim().length >= 2;
      field.classList.toggle('is-invalid', !valid);
      err.hidden = valid;
      if (!valid) {
        nameInput.focus();
        return;
      }
      const message = buildMessage();
      if (WHATSAPP_NUMBER) {
        const url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);
        const win = window.open(url, '_blank', 'noopener');
        if (!win) window.location.href = url;
      } else if (result && resultBox) {
        resultBox.value = message;
        result.hidden = false;
        result.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'nearest' });
      }
    });

    if (copyBtn && resultBox) {
      const label = $('span', copyBtn);
      copyBtn.addEventListener('click', async () => {
        const original = label.textContent;
        try {
          await navigator.clipboard.writeText(resultBox.value);
        } catch (error) {
          resultBox.select();
          document.execCommand('copy');
        }
        label.textContent = 'Mensaje copiado';
        setTimeout(() => {
          label.textContent = original;
        }, 2200);
      });
    }
  }

  /* ---------- BOTÓN FLOTANTE DE WHATSAPP ---------- */
  function initWhatsApp() {
    const wa = $('#wa-flotante');
    if (!wa || !WHATSAPP_NUMBER) return; // sin número: queda oculto y se usa el acceso flotante de cotización
    const text = 'Hola, vi la página de ' + NOMBRE_NEGOCIO + ' y quiero cotizar una fianza o un seguro.';
    wa.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
    wa.hidden = false;
    root.classList.add('wa-on');
  }

  /* ---------- ARRANQUE ---------- */
  function init() {
    initImages();
    initLoader();
    initChrome();
    initHero();
    initMarquee();
    initManifest();
    initAccordion();
    initRoute();
    initTabs();
    initCinema();
    initReveal();
    initCards();
    initStatus();
    initForm();
    initWhatsApp();

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('load', requestUpdate);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestUpdate);
    runUpdaters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
