import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from "axios";

const signOut = vi.fn();

// Loads a fresh copy of the api client with the given stored token.
const loadClient = async (token: string | null) => {
  vi.resetModules();
  vi.doMock("../config", () => ({
    API_BASE_URL: "http://api.test/v1",
    API_TIMEOUT: 1000,
  }));
  vi.doMock("./session", () => ({ signOut, getToken: () => token }));
  return (await import("./api")).default;
};

const ok = async (config: InternalAxiosRequestConfig) => ({
  data: {},
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

// Answers every request with a 401 and the given error message and code.
const unauthorized =
  (message: string, code: string | null = null) =>
  async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {
        statusCode: 401,
        data: null,
        success: false,
        message: "Unauthorized",
        code,
        errors: [{ message }],
      },
    });
  };

describe("api client", () => {
  beforeEach(() => signOut.mockClear());

  it("sends the stored token as a Bearer header", async () => {
    const api = await loadClient("abc.def.ghi");
    const { config } = await api.get("/programs", { adapter: ok });
    expect(config.headers.Authorization).toBe("Bearer abc.def.ghi");
  });

  it("sends no Authorization header without a token", async () => {
    const api = await loadClient(null);
    const { config } = await api.get("/health", { adapter: ok });
    expect(config.headers.Authorization).toBeUndefined();
  });

  it("signs out on a 401", async () => {
    const api = await loadClient("expired");
    const adapter = unauthorized("Session expired or invalid, please log in again", "SESSION_ENDED");

    await expect(api.get("/programs", { adapter })).rejects.toBeInstanceOf(AxiosError);
    expect(signOut).toHaveBeenCalledWith("expired");
  });

  it("signs out with the API's message when the user is no longer active", async () => {
    const api = await loadClient("blocked");
    const adapter = unauthorized("Your account is blocked; contact your administrator", "ACCOUNT_NOT_ACTIVE");

    await expect(api.get("/programs", { adapter })).rejects.toBeInstanceOf(AxiosError);
    expect(signOut).toHaveBeenCalledWith("inactive", "Your account is blocked; contact your administrator");
  });

  it("goes by the code, not the message text", async () => {
    const api = await loadClient("tenant");
    const adapter = unauthorized("Reworded: this institution can't log in", "TENANT_BLOCKED");

    await expect(api.get("/programs", { adapter })).rejects.toBeInstanceOf(AxiosError);
    expect(signOut).toHaveBeenCalledWith("tenant_blocked");
  });

  it("leaves a failed login to the login form", async () => {
    const api = await loadClient(null);
    const adapter = unauthorized("Invalid email or password");

    await expect(api.post("/auth/login", {}, { adapter })).rejects.toBeInstanceOf(AxiosError);
    expect(signOut).not.toHaveBeenCalled();
  });
});
