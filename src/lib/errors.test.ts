import { AxiosError, AxiosHeaders } from "axios";
import { describeError, getErrorMessage, getFieldErrors } from "./errors";

const apiError = (status: number, data: unknown) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  });

const validationError = apiError(422, {
  statusCode: 422,
  data: null,
  message: "Validation failed",
  success: false,
  errors: { name: "name is required", "address.city": "city is required" },
});

describe("getErrorMessage", () => {
  it("uses the first field error of a 422", () => {
    expect(getErrorMessage(validationError)).toBe("name is required");
  });

  it("uses the first message of an errors array", () => {
    const error = apiError(404, {
      statusCode: 404,
      data: null,
      message: "Not Found",
      success: false,
      errors: [{ message: "/v1/unknown endpoint is not found." }],
    });
    expect(getErrorMessage(error)).toBe("/v1/unknown endpoint is not found.");
  });

  it("falls back to the body message when errors is empty", () => {
    const error = apiError(409, {
      statusCode: 409,
      data: null,
      message: "Code already exists",
      success: false,
      errors: [],
    });
    expect(getErrorMessage(error)).toBe("Code already exists");
  });

  it("falls back to the Error message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });
});

describe("getFieldErrors", () => {
  it("returns the field errors of a 422", () => {
    expect(getFieldErrors(validationError)).toEqual({
      name: "name is required",
      "address.city": "city is required",
    });
  });

  it("returns nothing for other errors", () => {
    expect(getFieldErrors(apiError(404, { errors: [{ message: "x" }] }))).toEqual({});
    expect(getFieldErrors(new Error("boom"))).toEqual({});
  });
});

describe("describeError", () => {
  it('explains a request that got no answer instead of axios\' "Network Error"', () => {
    const error = new AxiosError("Network Error", "ERR_NETWORK");
    expect(describeError(error).kind).toBe("offline");
    expect(getErrorMessage(error)).not.toBe("Network Error");
  });

  it("tells a timeout apart", () => {
    expect(describeError(new AxiosError("timeout of 30000ms exceeded", "ECONNABORTED")).kind).toBe("timeout");
  });

  it("gives a 500 a friendly message and its request id", () => {
    const error = apiError(500, {
      statusCode: 500,
      data: null,
      message: "Something Went Wrong!",
      success: false,
      errors: [],
    });
    error.response!.headers = { "x-request-id": "abc-123" };
    expect(describeError(error)).toMatchObject({ kind: "server", requestId: "abc-123" });
    expect(describeError(error).message).not.toContain("Something Went Wrong!");
  });

  it("keeps the API message of a 503, which says what is missing", () => {
    const error = apiError(503, {
      statusCode: 503,
      data: null,
      message: "Email is not configured",
      success: false,
      errors: [],
    });
    expect(describeError(error)).toMatchObject({ kind: "server", message: "Email is not configured" });
  });

  it("marks a missing permission", () => {
    const error = apiError(403, {
      statusCode: 403,
      data: null,
      message: "Forbidden",
      success: false,
      errors: [{ message: "You do not have permission to read programs" }],
    });
    expect(describeError(error)).toMatchObject({
      kind: "forbidden",
      message: "You do not have permission to read programs",
    });
  });
});
