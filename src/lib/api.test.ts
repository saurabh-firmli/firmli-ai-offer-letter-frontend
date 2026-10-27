import { AxiosAdapter, AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from "axios";

const signOut = vi.fn();

// Loads a fresh copy of the api client with the given stored token (setToken changes it).
const loadClient = async (token: string | null) => {
  let current = token;
  vi.resetModules();
  vi.doMock("../config", () => ({
    API_BASE_URL: "http://api.test/v1",
    API_TIMEOUT: 1000,
  }));
  vi.doMock("./session", () => ({
    signOut,
    getToken: () => current,
    setToken: (value: string | null) => (current = value),
  }));
  return (await import("./api")).default;
};

const ok = async (config: InternalAxiosRequestConfig, data: unknown = {}) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

// A 401 with the given error message and code.
const unauthorizedError = (config: InternalAxiosRequestConfig, message: string, code: string | null = null) =>
  new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
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

// Answers every request with a 401 and the given error message and code.
const unauthorized =
  (message: string, code: string | null = null) =>
  async (config: InternalAxiosRequestConfig) => {
    throw unauthorizedError(config, message, code);
  };

const isRefresh = (config: InternalAxiosRequestConfig) => config.url?.endsWith("/auth/refresh");
const EXPIRED = "Session expired or invalid, please log in again";

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

  it("refreshes an expired access token once and sends the request again", async () => {
    const api = await loadClient("expired");
    const refresh = vi.fn();
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (isRefresh(config)) {
        refresh();
        return ok(config, { data: { token: "fresh" } });
      }
      if (config.headers.Authorization === "Bearer fresh") return ok(config);
      throw unauthorizedError(config, EXPIRED, "SESSION_ENDED");
    }) as AxiosAdapter;

    // Two requests failing together share one refresh.
    await Promise.all([api.get("/programs"), api.get("/campuses")]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out when the session can't be refreshed", async () => {
    const api = await loadClient("expired");
    api.defaults.adapter = unauthorized(EXPIRED, "SESSION_ENDED") as AxiosAdapter;

    await expect(api.get("/programs")).rejects.toBeInstanceOf(AxiosError);
    expect(signOut).toHaveBeenCalledWith("expired");
  });

  it("stays logged in when the refresh gets no answer (offline)", async () => {
    const api = await loadClient("expired");
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (isRefresh(config)) throw new AxiosError("Network Error", "ERR_NETWORK", config);
      throw unauthorizedError(config, EXPIRED, "SESSION_ENDED");
    }) as AxiosAdapter;

    await expect(api.get("/programs")).rejects.toBeInstanceOf(AxiosError);
    expect(signOut).not.toHaveBeenCalled();
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
