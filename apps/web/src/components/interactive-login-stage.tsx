"use client";

import { PointerEvent, ReactNode, useEffect, useRef } from "react";

export function InteractiveLoginStage({ children }: Readonly<{ children: ReactNode }>) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function setMotion(event: PointerEvent<HTMLDivElement> | null) {
    const stage = stageRef.current;
    if (!stage) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    const isTouch = !event || event.pointerType === "touch";
    const bounds = !isTouch ? stage.getBoundingClientRect() : null;
    const x = bounds && event ? Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) : 0.5;
    const y = bounds && event ? Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) : 0.5;

    frameRef.current = requestAnimationFrame(() => {
      stage.style.setProperty("--liquid-x", `${x * 100}%`);
      stage.style.setProperty("--liquid-y", `${y * 100}%`);
      stage.style.setProperty("--panel-rotate-y", isTouch ? "0deg" : `${(x - 0.5) * 3.5}deg`);
      stage.style.setProperty("--panel-rotate-x", isTouch ? "0deg" : `${(0.5 - y) * 2.5}deg`);
    });
  }

  return (
    <div
      ref={stageRef}
      className="login-stage"
      onPointerMove={setMotion}
      onPointerLeave={() => setMotion(null)}
    >
      <div className="liquid-backdrop">
        <span className="liquid-orb liquid-orb-cyan" aria-hidden="true" />
        <span className="liquid-orb liquid-orb-blue" aria-hidden="true" />
        <span className="liquid-orb liquid-orb-violet" aria-hidden="true" />
        <div className="liquid-logo-ambient" aria-hidden="true">
          <span className="liquid-logo-mark" />
        </div>
        <div className="liquid-logo-reveal" aria-hidden="true">
          <img className="liquid-logo-mark" src="/brand/logo.png" alt="" draggable={false} />
        </div>
        <span className="liquid-surface" />
      </div>
      <div className="login-panel-shell">{children}</div>
    </div>
  );
}
