import { classifyFcmErrorCode } from "./fcm-notification.provider";

describe("classifyFcmErrorCode", () => {
  it("marks an unregistered token as non-retryable and deactivatable", () => {
    expect(classifyFcmErrorCode("messaging/registration-token-not-registered")).toEqual({
      retryable: false,
      deactivateToken: true,
    });
  });

  it("marks an invalid token as non-retryable and deactivatable", () => {
    expect(classifyFcmErrorCode("messaging/invalid-registration-token")).toEqual({
      retryable: false,
      deactivateToken: true,
    });
  });

  it("marks a transient/quota error as retryable, token untouched", () => {
    expect(classifyFcmErrorCode("messaging/internal-error")).toEqual({ retryable: true, deactivateToken: false });
    expect(classifyFcmErrorCode("messaging/quota-exceeded")).toEqual({ retryable: true, deactivateToken: false });
  });

  it("treats an unknown/undefined code as retryable rather than deactivating a token on a guess", () => {
    expect(classifyFcmErrorCode(undefined)).toEqual({ retryable: true, deactivateToken: false });
  });
});
