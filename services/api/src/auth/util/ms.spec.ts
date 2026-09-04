import ms from "./ms";

describe("ms", () => {
  it("parses seconds, minutes, hours, days", () => {
    expect(ms("300s")).toBe(300_000);
    expect(ms("15m")).toBe(15 * 60 * 1000);
    expect(ms("1h")).toBe(60 * 60 * 1000);
    expect(ms("30d")).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("throws on an invalid duration string", () => {
    expect(() => ms("not-a-duration")).toThrow();
    expect(() => ms("")).toThrow();
  });
});
