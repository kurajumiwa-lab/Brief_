import React, { useRef, useEffect } from 'react';
import { AppPalette } from '../../styles/appPalette';

interface DepthBackgroundProps {
  children?: React.ReactNode;
  scrollOffset?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * DepthBackground
 * 3D Depth Canvas & Layered Backdrop.
 * Layer 1: Base linear gradient (depthDark -> depthMid -> primaryDark)
 * Layer 2: Soft glowing radial orbs (Deep Teal, Warm Amber, Light Teal)
 * Layer 3: Subtle texture particle dots
 */
export const DepthBackground: React.FC<DepthBackgroundProps> = ({
  children,
  scrollOffset = 0,
  className = '',
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Layer 1: Base linear gradient
    const baseGrad = ctx.createLinearGradient(0, 0, width, height);
    baseGrad.addColorStop(0, AppPalette.depthDark);
    baseGrad.addColorStop(0.5, AppPalette.depthMid);
    baseGrad.addColorStop(1, 'rgba(6, 69, 69, 0.8)'); // primaryDark at 0.8 opacity
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, width, height);

    // Layer 2: Soft glowing orbs
    const drawOrb = (cx: number, cy: number, r: number, colorStart: string) => {
      const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      orbGrad.addColorStop(0, colorStart);
      orbGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };

    // Orb 1: Top Right (Primary Teal)
    drawOrb(
      width * 0.8,
      height * 0.15 - scrollOffset * 0.1,
      width * 0.4,
      'rgba(11, 110, 110, 0.22)'
    );

    // Orb 2: Mid Left (Warm Amber)
    drawOrb(
      width * 0.15,
      height * 0.6 - scrollOffset * 0.05,
      width * 0.35,
      'rgba(232, 152, 94, 0.18)'
    );

    // Orb 3: Bottom Right (Primary Light Teal)
    drawOrb(
      width * 0.6,
      height * 0.85 - scrollOffset * 0.08,
      width * 0.3,
      'rgba(20, 145, 155, 0.16)'
    );

    // Layer 3: Subtle noise-like dots for texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    // Pseudo-random deterministic generator (seed 42)
    let seed = 42;
    const pseudoRandom = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < 60; i++) {
      const x = pseudoRandom() * width;
      const y = pseudoRandom() * height;
      const r = pseudoRandom() * 2 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [scrollOffset]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <canvas
        ref={canvasRef}
        width={1000}
        height={1400}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none -z-10"
        aria-hidden="true"
      />
      {children}
    </div>
  );
};
