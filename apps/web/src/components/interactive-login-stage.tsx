"use client";

import { PointerEvent, ReactNode, useRef } from "react";

export function InteractiveLoginStage({ children }: Readonly<{ children: ReactNode }>) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  function setMotion(event: PointerEvent<HTMLDivElement> | null) {
    const stage = stageRef.current;
    if (!stage) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      if (!event || event.pointerType === "touch") {
        stage.style.setProperty("--liquid-x", "50%");
        stage.style.setProperty("--liquid-y", "50%");
        stage.style.setProperty("--panel-rotate-x", "0deg");
        stage.style.setProperty("--panel-rotate-y", "0deg");
        return;
      }
      const bounds = stage.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      stage.style.setProperty("--liquid-x", `${x * 100}%`);
      stage.style.setProperty("--liquid-y", `${y * 100}%`);
      stage.style.setProperty("--panel-rotate-y", `${(x - 0.5) * 3.5}deg`);
      stage.style.setProperty("--panel-rotate-x", `${(0.5 - y) * 2.5}deg`);
    });
  }

  return (
    <div
      ref={stageRef}
      className="login-stage"
      onPointerMove={setMotion}
      onPointerLeave={() => setMotion(null)}
    >
      <div className="liquid-backdrop" aria-hidden="true">
        <span className="liquid-orb liquid-orb-cyan" />
        <span className="liquid-orb liquid-orb-blue" />
        <span className="liquid-orb liquid-orb-violet" />
        <span className="liquid-surface" />
      </div>
      <div className="login-panel-shell">{children}</div>
    </div>
  );
}
