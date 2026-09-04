import { newOrderNotification } from "./notification-templates";

describe("newOrderNotification", () => {
  it("matches section 20's exact example format", () => {
    // The brief's own example: "NEW ORDER #SA-20260829-1025 ₹1,250 6 Items Tap to view"
    const notification = newOrderNotification("order-1", "SA-20260829-1025", 125000, 6);

    expect(notification.title).toBe("NEW ORDER #SA-20260829-1025");
    expect(notification.body).toBe("₹1,250 · 6 Items · Tap to view");
    expect(notification.data).toEqual({ type: "ORDER", orderId: "order-1", entityType: "Order" });
  });

  it("uses singular 'Item' for a single-item order", () => {
    const notification = newOrderNotification("order-2", "SA-20260829-1026", 30000, 1);
    expect(notification.body).toBe("₹300 · 1 Item · Tap to view");
  });
});
