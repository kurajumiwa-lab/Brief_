// ---------------------------------------------------------------------------
// MOTION BUTTON — a press that is felt, not decorated.
//
// Micro tier (140ms). The press scales to 0.98 and dims slightly; releasing
// settles it back. There is no bounce, no glow, no spin — the button answers a
// tap with a quiet physical acknowledgement. Colors reference the canonical
// tokens only (no arbitrary hex in components).
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import { transitionFor } from './transitions';

export function MotionButton({
  style,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      {...rest}
      onPointerDown={(e) => {
        setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        setPressed(false);
        onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        setPressed(false);
        onPointerLeave?.(e);
      }}
      style={{
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        filter: pressed ? 'brightness(0.96)' : 'none',
        transition: transitionFor(['transform', 'filter'], 'micro'),
        minHeight: 44,
        background: 'var(--color-primary)',
        color: 'var(--accent-ink)',
        border: 'none',
        borderRadius: 'var(--radius-btn)',
        padding: '0 20px',
        cursor: 'pointer',
        ...style
      }}
    >
      {children}
    </button>
  );
}
