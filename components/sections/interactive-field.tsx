"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useState } from "react";

export function InteractiveField() {
  const [point, setPoint] = useState({ x: 50, y: 50 });

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    setPoint({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  const style = {
    "--x": `${point.x}%`,
    "--y": `${point.y}%`,
    background:
      "radial-gradient(circle at var(--x) var(--y), rgba(215, 255, 105, 0.24), transparent 22%), linear-gradient(135deg, rgba(102, 227, 255, 0.12), rgba(245, 245, 240, 0.02))",
  } as CSSProperties;

  return (
    <div
      className="relative min-h-80 overflow-hidden rounded-lg border border-border bg-card"
      style={style}
      onPointerMove={handlePointerMove}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(245,245,240,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(245,245,240,0.08)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="relative flex h-full min-h-80 flex-col justify-between p-6">
        <p className="text-sm text-muted-foreground">Pointer field / motion study</p>
        <div>
          <p className="text-5xl font-semibold leading-none text-foreground">Lab 01</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            A code-native interaction surface for cursor-driven light, grid depth, and future shader experiments.
          </p>
        </div>
      </div>
    </div>
  );
}
