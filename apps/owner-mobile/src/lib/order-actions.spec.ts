import { OrderStatus, Permission } from "@shri-anandam/shared-types";
import { getAvailableActions } from "./order-actions";

describe("getAvailableActions", () => {
  const fullPermissions = [Permission.ORDER_ACCEPT, Permission.ORDER_REJECT, Permission.ORDER_CANCEL];

  it("offers Accept and Reject on a PENDING delivery order for a fully-permissioned staff member", () => {
    const actions = getAvailableActions(OrderStatus.PENDING, "DELIVERY", fullPermissions);
    expect(actions.map((a) => a.status).sort()).toEqual([OrderStatus.ACCEPTED, OrderStatus.CANCELLED, OrderStatus.REJECTED].sort());
  });

  it("hides actions the staff member's permissions don't cover (kitchen staff with only ORDER_ACCEPT)", () => {
    const actions = getAvailableActions(OrderStatus.PENDING, "DELIVERY", [Permission.ORDER_ACCEPT]);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.status).toBe(OrderStatus.ACCEPTED);
  });

  it("offers OUT_FOR_DELIVERY from READY for a delivery order", () => {
    const actions = getAvailableActions(OrderStatus.READY, "DELIVERY", fullPermissions);
    expect(actions.map((a) => a.status)).toContain(OrderStatus.OUT_FOR_DELIVERY);
  });

  it("skips OUT_FOR_DELIVERY from READY for a pickup order, offering Mark Delivered directly", () => {
    const actions = getAvailableActions(OrderStatus.READY, "PICKUP", fullPermissions);
    const statuses = actions.map((a) => a.status);
    expect(statuses).not.toContain(OrderStatus.OUT_FOR_DELIVERY);
    expect(statuses).toContain(OrderStatus.DELIVERED);
  });

  it("returns no actions for a terminal status", () => {
    expect(getAvailableActions(OrderStatus.DELIVERED, "DELIVERY", fullPermissions)).toEqual([]);
    expect(getAvailableActions(OrderStatus.CANCELLED, "DELIVERY", fullPermissions)).toEqual([]);
  });

  it("marks REJECTED and CANCELLED as danger-variant, ACCEPTED as primary", () => {
    const actions = getAvailableActions(OrderStatus.PENDING, "DELIVERY", fullPermissions);
    expect(actions.find((a) => a.status === OrderStatus.ACCEPTED)?.variant).toBe("primary");
    expect(actions.find((a) => a.status === OrderStatus.REJECTED)?.variant).toBe("danger");
    expect(actions.find((a) => a.status === OrderStatus.CANCELLED)?.variant).toBe("danger");
  });
});
