import { queryClient } from "./queryClient";
import { clearSessionData } from "./session";

describe("clearSessionData", () => {
  it("empties the query cache", () => {
    queryClient.setQueryData(["offer-letters"], [{ id: 1 }]);

    clearSessionData();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
