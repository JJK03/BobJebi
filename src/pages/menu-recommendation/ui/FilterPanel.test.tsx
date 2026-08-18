// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterPanel } from "./FilterPanel";

const defaultProps = {
  category: null,
  budget: null,
  travelMode: null,
  travelTimeLimit: null,
  hasSelections: false,
  onCategoryChange: vi.fn(),
  onBudgetChange: vi.fn(),
  onTravelModeChange: vi.fn(),
  onTravelTimeChange: vi.fn(),
  onReset: vi.fn(),
};

describe("FilterPanel 음식 종류", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("세부 음식 종류를 더보기 토글 안에 표시한다", async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    expect(screen.queryByRole("button", { name: "분식·간편식" })).toBeNull();

    const moreButton = screen.getByRole("button", { name: "더보기" });
    expect(moreButton.getAttribute("aria-expanded")).toBe("false");

    await user.click(moreButton);

    expect(moreButton.getAttribute("aria-expanded")).toBe("true");
    await user.click(screen.getByRole("button", { name: "분식·간편식" }));

    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("분식·간편식");
    expect(screen.queryByRole("button", { name: "분식·간편식" })).toBeNull();
  });

  it("선택한 세부 음식 종류를 더보기 버튼에 표시한다", () => {
    render(<FilterPanel {...defaultProps} category="베이커리·디저트" />);

    const moreButton = screen.getByRole("button", {
      name: "더보기, 선택됨: 베이커리·디저트",
    });
    expect(moreButton.getAttribute("aria-pressed")).toBe("true");
    expect(moreButton.querySelector(".category-more-selection")?.textContent).toBe(
      "베이커리·디저트",
    );
  });
});
