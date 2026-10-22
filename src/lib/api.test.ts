import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from "axios";

const signOut = vi.fn();

// Loads a fresh copy of the api client with the given VITE_DEV_TENANT_ID value.
const loadClient = async (devTenantId: string) => {
  vi.resetModules();
  vi.doMock("../config", () => ({
    API_BASE_URL: "http://api.test/v1",
    API_TIMEOUT: 1000,
    DEV_TENANT_ID: devTenantId,
  }));
  vi.doMock("./session", () => ({ signOut }));
  return (await import("./api")).default;
};

const ok = async (config: InternalAxiosRequestConfig) => ({
  data: {},
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

describe("api client", () => {
  beforeEach(() => signOut.mockClear());

  it("sends X-Tenant-Id when VITE_DEV_TENANT_ID is set", async () => {
    const axios = await loadClient("6f1c2a52-8b3e-4d1a-9c7e-2f4b5a6d7e8f");
    const { config } = await axios.get("/offer-letters", { adapter: ok });
    expect(config.headers["X-Tenant-Id"]).toBe("6f1c2a52-8b3e-4d1a-9c7e-2f4b5a6d7e8f");
  });

  it("sends no X-Tenant-Id when VITE_DEV_TENANT_ID is empty", async () => {
    const axios = await loadClient("");
    const { config } = await axios.get("/offer-letters", { adapter: ok });
    expect(config.headers["X-Tenant-Id"]).toBeUndefined();
  });

  it("signs out on a 401, including an unresolved tenant", async () => {
    const axios = await loadClient("");
    const adapter = async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          statusCode: 401,
          success: false,
          message: "Unauthorized",
          errors: [{ message: "Tenant could not be resolved." }],
        },
      });
    };

    await expect(axios.get("/offer-letters", { adapter })).rejects.toBeInstanceOf(AxiosError);
    expect(signOut).toHaveBeenCalledWith("unauthenticated");
  });
});
