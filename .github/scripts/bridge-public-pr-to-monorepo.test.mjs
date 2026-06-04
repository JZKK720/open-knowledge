import { describe, expect, test } from "bun:test";
import {
  checkOrgMembership,
  createClaGateGh,
  postCommitStatus,
  readCommitClaStatus,
} from "./bridge-public-pr-to-monorepo.mjs";

// A fake `githubRequest`: records every call and returns the queued response.
// The bridge's GitHub adapters are the only seam where the `license/cla` and
// `cla/verified` context strings (the gate's enforcement surface) live, so the
// tests assert the request shape at that boundary, not internal call counts.
const fakeRequest = (response) => {
  const calls = [];
  const request = async (args) => {
    calls.push(args);
    return response;
  };
  return { request, calls };
};

describe("readCommitClaStatus", () => {
  test("extracts the license/cla state from the combined status", async () => {
    const { request } = fakeRequest({
      statuses: [
        { context: "ci/build", state: "success" },
        { context: "license/cla", state: "success" },
      ],
    });
    expect(await readCommitClaStatus({ token: "t", repo: "o/r", sha: "abc", request })).toBe(
      "success",
    );
  });

  test("returns null when the license/cla context is absent", async () => {
    const { request } = fakeRequest({ statuses: [{ context: "ci/build", state: "failure" }] });
    expect(await readCommitClaStatus({ token: "t", repo: "o/r", sha: "abc", request })).toBeNull();
  });

  test("returns null for an empty status set", async () => {
    const { request } = fakeRequest({ statuses: [] });
    expect(await readCommitClaStatus({ token: "t", repo: "o/r", sha: "abc", request })).toBeNull();
  });

  test("requests the combined status with per_page=100 so license/cla can't fall off page 1", async () => {
    const { request, calls } = fakeRequest({ statuses: [] });
    await readCommitClaStatus({ token: "t", repo: "owner/repo", sha: "deadbeef", request });
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/repos/owner/repo/commits/deadbeef/status?per_page=100");
  });
});

describe("postCommitStatus", () => {
  test("POSTs the given state/context/description to the commit's statuses endpoint", async () => {
    const { request, calls } = fakeRequest(undefined);
    await postCommitStatus({
      token: "t",
      repo: "owner/repo",
      sha: "abc123",
      state: "failure",
      context: "cla/verified",
      description: "held",
      request,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "/repos/owner/repo/statuses/abc123",
      body: { state: "failure", context: "cla/verified", description: "held" },
    });
  });
});

describe("checkOrgMembership", () => {
  test("returns true on a 204 (member)", async () => {
    const { request, calls } = fakeRequest(null);
    expect(
      await checkOrgMembership({ token: "t", org: "inkeep", login: "octocat", request }),
    ).toBe(true);
    expect(calls[0].path).toBe("/orgs/inkeep/members/octocat");
  });

  test("returns false on a 404 (non-member)", async () => {
    const request = async () => {
      const error = new Error("not found (404)");
      error.status = 404;
      throw error;
    };
    expect(
      await checkOrgMembership({ token: "t", org: "inkeep", login: "outsider", request }),
    ).toBe(false);
  });

  test("propagates non-404 errors so the gate fails closed", async () => {
    const request = async () => {
      const error = new Error("forbidden (403)");
      error.status = 403;
      throw error;
    };
    await expect(
      checkOrgMembership({ token: "t", org: "inkeep", login: "x", request }),
    ).rejects.toThrow(/403/);
  });
});

describe("createClaGateGh", () => {
  const deps = {
    publicToken: "public-token",
    publicRepo: "inkeep/open-knowledge-legacy",
    internalToken: "internal-token",
    internalRepo: "inkeep/agents-private",
  };

  test("readClaStatus reads license/cla from the public PR head, on the public token", async () => {
    const { request, calls } = fakeRequest({
      statuses: [{ context: "license/cla", state: "pending" }],
    });
    const gh = createClaGateGh({ ...deps, request });
    const state = await gh.readClaStatus({ head: { sha: "public-head" } });
    expect(state).toBe("pending");
    expect(calls[0].token).toBe("public-token");
    expect(calls[0].path).toBe(
      "/repos/inkeep/open-knowledge-legacy/commits/public-head/status?per_page=100",
    );
  });

  test("setVerifiedStatus posts the cla/verified context to the internal PR head", async () => {
    const { request, calls } = fakeRequest(undefined);
    const gh = createClaGateGh({ ...deps, request });
    await gh.setVerifiedStatus({ head: { sha: "internal-head" } }, "failure", "needs signature");
    expect(calls).toHaveLength(1);
    expect(calls[0].token).toBe("internal-token");
    expect(calls[0].path).toBe("/repos/inkeep/agents-private/statuses/internal-head");
    expect(calls[0].body).toEqual({
      state: "failure",
      context: "cla/verified",
      description: "needs signature",
    });
  });

  test("isOrgMember checks the internal repo's org on the internal token", async () => {
    const { request, calls } = fakeRequest(null);
    const gh = createClaGateGh({ ...deps, request });
    expect(await gh.isOrgMember("octocat")).toBe(true);
    expect(calls[0].token).toBe("internal-token");
    expect(calls[0].path).toBe("/orgs/inkeep/members/octocat");
  });
});
