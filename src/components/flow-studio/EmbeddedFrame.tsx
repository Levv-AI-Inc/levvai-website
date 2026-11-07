'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const same = (a: Box | null, b: Box): boolean =>
  a !== null && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

/**
 * Binding decision 1: globals.css normalises the controls and tables inside the app's `main.flex-1`, which 04 does not
 * expect, and the brand palette repaints slate and cyan everywhere (the shell's `.levv-spec` restores them, 04 §1.2). So
 * the admin column holds only this placeholder, and the shell is portaled to <body> and pinned over it. Below the app
 * header (z-20) and sidebar (z-30), so their menus still open over it.
 */
export function EmbeddedFrame({ children }: { children: ReactNode }) {
  const placeholder = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const element = placeholder.current;
    if (!element) return undefined;
    const track = (): void => {
      const { left, top, width, height } = element.getBoundingClientRect();
      setBox((current) => {
        const next = { left, top, width, height };
        return same(current, next) ? current : next;
      });
    };
    track();
    // The placeholder resizes with the window and with the app sidebar's collapse animation; a shorter window lets the page scroll.
    const observer = new ResizeObserver(track);
    observer.observe(element);
    window.addEventListener('resize', track);
    window.addEventListener('scroll', track, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', track);
      window.removeEventListener('scroll', track, true);
    };
  }, []);

  return (
    <>
      <div ref={placeholder} data-flow-studio-placeholder aria-hidden className="absolute inset-0" />
      {box
        ? createPortal(
            <div data-flow-studio-host style={{ position: 'fixed', zIndex: 10, ...box }}>
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
