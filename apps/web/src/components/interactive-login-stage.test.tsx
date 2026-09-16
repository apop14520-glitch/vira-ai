import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InteractiveLoginStage } from "@/components/interactive-login-stage";

describe("InteractiveLoginStage", () => {
  it("apresenta a logo da VIRA.AI como parte do fundo interativo", () => {
    const { container } = render(
      <InteractiveLoginStage>
        <div>Conteúdo do painel</div>
      </InteractiveLoginStage>,
    );

    const revealLayer = container.querySelector<HTMLElement>(".liquid-logo-reveal");
    const gradientLayer = container.querySelector<HTMLElement>(".liquid-logo-gradient");
    const logo = revealLayer?.querySelector<HTMLImageElement>(".liquid-logo-mark");
    expect(revealLayer).toHaveAttribute("aria-hidden", "true");
    expect(gradientLayer).toHaveAttribute("aria-hidden", "true");
    expect(logo).toHaveAttribute("src", "/brand/logo.png");
    expect(logo).toHaveClass("liquid-logo-mark");
  });

  it("move o destaque líquido e a inclinação do painel conforme o ponteiro", async () => {
    const { container } = render(
      <InteractiveLoginStage>
        <div>Conteúdo do painel</div>
      </InteractiveLoginStage>,
    );

    const stage = container.querySelector<HTMLElement>(".login-stage");
    expect(stage).not.toBeNull();
    if (!stage) return;
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 1000, height: 500 }),
    });

    fireEvent(
      stage,
      new MouseEvent("pointermove", { bubbles: true, clientX: 750, clientY: 125 }),
    );

    await waitFor(() => {
      expect(stage).toHaveStyle({
        "--liquid-x": "75%",
        "--liquid-y": "25%",
        "--panel-rotate-x": "0.625deg",
        "--panel-rotate-y": "0.875deg",
      });
    });
  });
});
