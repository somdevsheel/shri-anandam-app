import { OrderStatus, isValidOrderStatusTransition, TERMINAL_ORDER_STATUSES } from "./order-status";

describe("order status state machine", () => {
  it("allows the linear happy-path progression", () => {
    expect(isValidOrderStatusTransition(OrderStatus.PENDING, OrderStatus.ACCEPTED)).toBe(true);
    expect(isValidOrderStatusTransition(OrderStatus.ACCEPTED, OrderStatus.PREPARING)).toBe(true);
    expect(isValidOrderStatusTransition(OrderStatus.PREPARING, OrderStatus.READY)).toBe(true);
    expect(isValidOrderStatusTransition(OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY)).toBe(true);
    expect(isValidOrderStatusTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED)).toBe(true);
  });

  it("allows pickup orders to skip OUT_FOR_DELIVERY", () => {
    expect(isValidOrderStatusTransition(OrderStatus.READY, OrderStatus.DELIVERED)).toBe(true);
  });

  it("rejects skipping ahead in the flow", () => {
    expect(isValidOrderStatusTransition(OrderStatus.PENDING, OrderStatus.PREPARING)).toBe(false);
    expect(isValidOrderStatusTransition(OrderStatus.PENDING, OrderStatus.READY)).toBe(false);
  });

  it("rejects the documented invalid example: DELIVERED -> PREPARING", () => {
    expect(isValidOrderStatusTransition(OrderStatus.DELIVERED, OrderStatus.PREPARING)).toBe(false);
  });

  it("rejects any transition out of a terminal status", () => {
    for (const status of TERMINAL_ORDER_STATUSES) {
      for (const target of Object.values(OrderStatus)) {
        expect(isValidOrderStatusTransition(status, target)).toBe(false);
      }
    }
  });

  it("allows cancellation from every non-terminal status", () => {
    for (const status of Object.values(OrderStatus)) {
      if (TERMINAL_ORDER_STATUSES.has(status)) continue;
      expect(isValidOrderStatusTransition(status, OrderStatus.CANCELLED)).toBe(true);
    }
  });
});
