import { describe, expect, it, vi } from "vitest";

import { authorizeAny, createAuthorize, type RpcClient } from "./index";

function fakeClient(responder: (fn: string, args: Record<string, unknown>) => unknown): {
  client: RpcClient;
  calls: Array<Record<string, unknown>>;
} {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    client: {
      rpc(fn, args) {
        calls.push(args);
        return Promise.resolve({ data: responder(fn, args), error: null });
      },
    },
  };
}

describe("createAuthorize", () => {
  it("maps args onto the authorize() RPC contract", async () => {
    const { client, calls } = fakeClient(() => true);
    const authorize = createAuthorize(client);
    await expect(
      authorize({ permission: "hr.absence.approve", companyId: "c1", teamId: "t1", ownerId: "u1" })
    ).resolves.toBe(true);
    expect(calls[0]).toEqual({
      p_permission: "hr.absence.approve",
      p_company: "c1",
      p_team: "t1",
      p_owner: "u1",
    });
  });

  it("omitted context becomes null (matches DB defaults)", async () => {
    const { client, calls } = fakeClient(() => true);
    await createAuthorize(client)({ permission: "a.b.c", companyId: "c1" });
    expect(calls[0]).toEqual({ p_permission: "a.b.c", p_company: "c1", p_team: null, p_owner: null });
  });

  it("caches identical checks within one instance", async () => {
    const { client, calls } = fakeClient(() => true);
    const authorize = createAuthorize(client);
    await Promise.all([
      authorize({ permission: "a.b.c", companyId: "c1" }),
      authorize({ permission: "a.b.c", companyId: "c1" }),
      authorize({ permission: "a.b.c", companyId: "c2" }),
    ]);
    expect(calls).toHaveLength(2);
  });

  it("fails closed on RPC error or non-true data", async () => {
    const erroring: RpcClient = {
      rpc: () => Promise.resolve({ data: null, error: { message: "boom" } }),
    };
    await expect(
      createAuthorize(erroring)({ permission: "a.b.c", companyId: "c1" })
    ).resolves.toBe(false);

    const nonBoolean = fakeClient(() => "yes").client;
    await expect(
      createAuthorize(nonBoolean)({ permission: "a.b.c", companyId: "c1" })
    ).resolves.toBe(false);

    const rejecting: RpcClient = { rpc: () => Promise.reject(new Error("net")) };
    await expect(
      createAuthorize(rejecting)({ permission: "a.b.c", companyId: "c1" })
    ).resolves.toBe(false);
  });

  it("authorizeAny ORs across permissions", async () => {
    const grantSpy = vi.fn((_fn: string, args: Record<string, unknown>) =>
      args.p_permission === "platform.role.manage"
    );
    const { client } = fakeClient(grantSpy);
    const authorize = createAuthorize(client);
    await expect(
      authorizeAny(authorize, "c1", ["platform.team.manage", "platform.role.manage"])
    ).resolves.toBe(true);
    await expect(authorizeAny(authorize, "c1", ["platform.member.manage"])).resolves.toBe(false);
  });
});
