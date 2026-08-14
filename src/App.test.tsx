// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Restaurant } from "./domain/restaurant";
import { useGeolocation } from "./hooks/useGeolocation";
import { useRestaurants } from "./hooks/useRestaurants";
import {
  searchLocations,
  type LocationSearchResult,
} from "./services/kakaoLocationSearch";

vi.mock("./hooks/useGeolocation", () => ({
  useGeolocation: vi.fn(),
}));

vi.mock("./hooks/useRestaurants", () => ({
  useRestaurants: vi.fn(),
}));

vi.mock("./services/kakaoLocationSearch", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./services/kakaoLocationSearch")>();

  return {
    ...actual,
    isLocationSearchConfigured: true,
    searchLocations: vi.fn(),
  };
});

const USER_POSITION = { latitude: 37.39, longitude: 126.64 };

const restaurants: Restaurant[] = [
  {
    id: "korean-restaurant",
    name: "착한한식",
    category: "한식",
    province: "인천광역시",
    district: "연수구",
    address: "인천 연수구 한식로 1",
    latitude: 37.39,
    longitude: 126.64,
    menus: [{ name: "백반", price: 9_000 }],
    kakaoPlaceId: "kakao-korean",
  },
  {
    id: "chinese-restaurant-cheap",
    name: "착한중식",
    category: "중식",
    province: "인천광역시",
    district: "연수구",
    address: "인천 연수구 중식로 1",
    latitude: 37.3905,
    longitude: 126.6405,
    menus: [{ name: "짜장면", price: 14_000 }],
    kakaoPlaceId: "kakao-chinese-cheap",
  },
  {
    id: "chinese-restaurant-premium",
    name: "든든중식",
    category: "중식",
    province: "인천광역시",
    district: "연수구",
    address: "인천 연수구 중식로 2",
    latitude: 37.391,
    longitude: 126.641,
    menus: [{ name: "짬뽕", price: 18_000 }],
  },
];

async function selectConditions(
  user: ReturnType<typeof userEvent.setup>,
  {
    category = "전체",
    budget = "제한 없음",
  }: { category?: string; budget?: string } = {},
) {
  await user.click(screen.getByRole("button", { name: category }));
  await user.click(screen.getByRole("button", { name: budget }));
  await user.click(screen.getByRole("button", { name: "🚶 도보" }));
  await user.click(screen.getByRole("button", { name: "10분 이내" }));
}

describe("App 사용자 흐름", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(useGeolocation).mockReturnValue({
      position: USER_POSITION,
      status: "success",
      requestLocation: vi.fn(),
    });
    vi.mocked(useRestaurants).mockReturnValue({
      restaurants,
      status: "success",
      error: "",
    });
    vi.mocked(searchLocations).mockReset();
    vi.mocked(searchLocations).mockResolvedValue([]);
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    window.requestAnimationFrame = vi.fn((callback) => {
      callback(0);
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    cleanup();
    if (vi.isFakeTimers()) {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
    vi.restoreAllMocks();
  });

  it("선택한 음식 종류와 예산에 맞춰 후보 수를 갱신한다", async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectConditions(user, { category: "중식", budget: "~15,000원" });

    expect(screen.getByText("후보 1곳")).toBeTruthy();
    expect(screen.getByText("15,000원 이하 중식 후보가 참여해요")).toBeTruthy();
  });

  it("빈 결과에서 음식 종류를 완화해 후보를 다시 찾는다", async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectConditions(user, { category: "일식", budget: "~10,000원" });
    expect(
      screen.getByRole("heading", {
        name: "선택한 조건에 해당하는 식당이 없어요",
      }),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "음식 종류 전체로 변경" }),
    );

    expect(
      screen.queryByRole("heading", {
        name: "선택한 조건에 해당하는 식당이 없어요",
      }),
    ).toBeNull();
    expect(screen.getByText("후보 1곳")).toBeTruthy();
  });

  it("검색한 위치를 선택해 추천 기준 위치를 변경한다", async () => {
    const user = userEvent.setup();
    const searchedLocation: LocationSearchResult = {
      id: "songdo-central-park",
      name: "송도 센트럴파크",
      address: "인천 연수구 컨벤시아대로 160",
      coordinates: USER_POSITION,
    };
    vi.mocked(searchLocations).mockResolvedValue([searchedLocation]);
    render(<App />);

    await user.type(
      screen.getByRole("searchbox", { name: "원하는 위치 검색" }),
      "송도 센트럴파크",
    );
    await user.click(screen.getByRole("button", { name: "검색" }));
    await user.click(
      await screen.findByRole("button", { name: /송도 센트럴파크/ }),
    );

    expect(
      screen.getByRole("heading", {
        name: "송도 센트럴파크 주변을 보고 있어요",
      }),
    ).toBeTruthy();
  });

  it("제비를 뽑아 결과 카드와 정확한 카카오맵 링크를 표시한다", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = userEvent.setup();
    render(<App />);
    await selectConditions(user);
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "한 곳 뽑기" }));
    expect(
      screen.getByRole("button", { name: "제비를 뽑는 중…" }),
    ).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(1_800);
    });

    expect(screen.getByRole("heading", { name: "착한한식" })).toBeTruthy();
    const kakaoMapLink = screen.getByRole("link", {
      name: /카카오맵에서 식당 보기/,
    });
    expect(kakaoMapLink.getAttribute("href")).toBe(
      "https://map.kakao.com/link/map/kakao-korean",
    );
  });

  it("추첨 중 조건을 변경하면 진행 중인 결과를 취소한다", async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectConditions(user);
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "한 곳 뽑기" }));
    fireEvent.click(screen.getByRole("button", { name: "중식" }));
    await act(async () => {
      vi.advanceTimersByTime(1_800);
    });

    expect(screen.queryByText("오늘 뽑힌 식당")).toBeNull();
    expect(screen.queryByRole("heading", { name: "착한한식" })).toBeNull();
    expect(screen.getByRole("button", { name: "한 곳 뽑기" })).toBeTruthy();
  });
});
