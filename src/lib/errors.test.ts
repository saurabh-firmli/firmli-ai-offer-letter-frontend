import { AxiosError, AxiosHeaders } from "axios";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("prefers the first validation error from the backend", () => {
    const error = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 422,
      statusText: "Unprocessable Entity",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { statusCode: 422, message: "Validation failed", errors: [{ message: "name is required" }], success: false },
    });
    expect(getErrorMessage(error)).toBe("name is required");
  });

  it("falls back to the Error message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });
});
