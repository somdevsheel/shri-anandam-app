import { OrderStatus, Permission } from "@shri-anandam/shared-types";
import { getAvailableActions, getPrimaryAction } from "./order-actions";

const kitchenPermissions = [Permission.ORDER_ACCEPT];
const fullPermissions = [Permission.ORDER_ACCEPT, Permission.ORDER_REJECT, Permission.ORDER_CANCEL];

describe("getAvailableActions", () => {
  it("a KITCHEN-role login (order.accept only) sees Accept but not Reject/Cancel on a PENDING order", () => {
    const actions = getAvailableActions(OrderStatus.PENDING, "DELIVERY", kitchenPermissions);
    expect(actions.map((a) => a.status)).toEqual([OrderStatus.ACCEPTED]);
  });

  it("a fully-permissioned login sees Accept, Reject, and Cancel", () => {
    const actions = getAvailableActions(OrderStatus.PENDING, "DELIVERY", fullPermissions);
    expect(actions.map((a) => a.status).sort()).toEqual([OrderStatus.ACCEPTED, OrderStatus.CANCELLED, OrderStatus.REJECTED].sort());
  });

  it("skips OUT_FOR_DELIVERY for a pickup order", () => {
    const statuses = getAvailableActions(OrderStatus.READY, "PICKUP", fullPermissions).map((a) => a.status);
    expect(statuses).not.toContain(OrderStatus.OUT_FOR_DELIVERY);
    expect(statuses).toContain(OrderStatus.DELIVERED);
  });
});

describe("getPrimaryAction", () => {
  it("returns Accept for a PENDING order", () => {
    expect(getPrimaryAction(OrderStatus.PENDING, "DELIVERY", kitchenPermissions)?.status).toBe(OrderStatus.ACCEPTED);
  });

  it("never returns a destructive action even with full permissions", () => {
    const action = getPrimaryAction(OrderStatus.PENDING, "DELIVERY", fullPermissions);
    expect(action?.variant).toBe("primary");
    expect(action?.status).toBe(OrderStatus.ACCEPTED);
  });

  it("returns null for a terminal status", () => {
    expect(getPrimaryAction(OrderStatus.DELIVERED, "DELIVERY", fullPermissions)).toBeNull();
  });

  it("returns null when the staff member holds no relevant permission", () => {
    expect(getPrimaryAction(OrderStatus.PENDING, "DELIVERY", [])).toBeNull();
  });
});
