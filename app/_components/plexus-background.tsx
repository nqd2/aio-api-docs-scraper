"use client";

import { useEffect, useRef } from "react";

type PlexusOptions = {
  points?: number;
  maxSpeed?: number; // px/s
  connectDistance?: number; // px
  lineWidth?: number;
  pointRadius?: number;
  opacity?: number; // 0..1
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  const s = input.trim();
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const hex = m[1];
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b };
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
}

function rgba({ r, g, b }: { r: number; g: number; b: number }, a: number) {
  return `rgba(${r}, ${g}, ${b}, ${clamp(a, 0, 1)})`;
}

type Point = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export function PlexusBackground(props: PlexusOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const bgHex = rootStyle.getPropertyValue("--background").trim();
    const fgHex = rootStyle.getPropertyValue("--foreground").trim();
    const accentHex = rootStyle.getPropertyValue("--accent").trim();

    const fg = parseHexColor(fgHex) ?? { r: 250, g: 250, b: 250 };
    const accent = parseHexColor(accentHex) ?? fg;
    void bgHex; // reserved for future background blending

    let w = 0;
    let h = 0;
    let dpr = 1;

    const maxSpeed = props.maxSpeed ?? 36;
    const pointRadius = props.pointRadius ?? 1.35;
    const lineWidth = props.lineWidth ?? 1;
    const baseOpacity = props.opacity ?? 0.7;

    const pointsTarget = props.points ?? 72;
    const connectDistance = props.connectDistance ?? 140;

    const mouse = { x: 0, y: 0, active: false };

    const points: Point[] = [];

    const reseed = () => {
      points.length = 0;
      const count = clamp(Math.round(pointsTarget * (w * h) / (1100 * 700)), 36, 140);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.35 + Math.random() * 0.75) * maxSpeed;
        points.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        });
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      dpr = clamp(window.devicePixelRatio || 1, 1, 2);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      reseed();
    };

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.04);
      last = now;

      ctx.clearRect(0, 0, w, h);

      // update points
      for (const p of points) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0) {
          p.x = 0;
          p.vx *= -1;
        } else if (p.x > w) {
          p.x = w;
          p.vx *= -1;
        }
        if (p.y < 0) {
          p.y = 0;
          p.vy *= -1;
        } else if (p.y > h) {
          p.y = h;
          p.vy *= -1;
        }
      }

      // lines
      const dist2 = connectDistance * connectDistance;
      ctx.lineWidth = lineWidth;

      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > dist2) continue;

          const t = 1 - d2 / dist2;
          const alpha = baseOpacity * (0.08 + 0.35 * t);
          ctx.strokeStyle = rgba(fg, alpha);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // points + mouse attraction
      for (const p of points) {
        let r = pointRadius;
        let col = fg;
        let alpha = baseOpacity * 0.55;

        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          const mDist = 220;
          if (d2 < mDist * mDist) {
            const t = 1 - d2 / (mDist * mDist);
            r = pointRadius + 1.1 * t;
            col = accent;
            alpha = baseOpacity * (0.55 + 0.35 * t);
          }
        }

        ctx.fillStyle = rgba(col, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = window.requestAnimationFrame(tick);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };

    const onPointerLeave = () => {
      mouse.active = false;
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
    resize();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true } as AddEventListenerOptions);

    raf = window.requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave as EventListener);
      window.cancelAnimationFrame(raf);
    };
  }, [props.connectDistance, props.lineWidth, props.maxSpeed, props.opacity, props.pointRadius, props.points]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

