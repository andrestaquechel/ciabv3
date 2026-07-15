const DEFAULT_PROJECT_ID = "prj_g8c8nmUgyalHligDpawKIQ2dgOBu";
const DEFAULT_TEAM_ID = "team_VHR7ZWEEt9j9LwA5CBfPM8E1";

type EnvTarget = "production" | "preview" | "development";

export async function upsertVercelEnvVar({
  key,
  value,
  targets = ["production", "preview", "development"],
}: {
  key: string;
  value: string;
  targets?: EnvTarget[];
}) {
  const token = process.env.VERCEL_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "VERCEL_ACCESS_TOKEN is not configured on this deployment. Add it in Vercel env vars (one-time) so Install to Vercel can run.",
    );
  }

  const projectId = process.env.VERCEL_PROJECT_ID?.trim() || DEFAULT_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || DEFAULT_TEAM_ID;

  const listUrl = new URL(
    `https://api.vercel.com/v9/projects/${projectId}/env`,
  );
  listUrl.searchParams.set("teamId", teamId);

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listData = (await listRes.json()) as {
    envs?: Array<{ id: string; key: string }>;
  };
  if (!listRes.ok) {
    throw new Error("Could not list Vercel env vars.");
  }

  const existing = listData.envs?.find((e) => e.key === key);

  if (existing) {
    const patchUrl = new URL(
      `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}`,
    );
    patchUrl.searchParams.set("teamId", teamId);
    const patchRes = await fetch(patchUrl.toString(), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        value,
        target: targets,
        type: "encrypted",
      }),
    });
    if (!patchRes.ok) {
      throw new Error(`Could not update Vercel env var ${key}.`);
    }
    return { action: "updated" as const, key };
  }

  const createUrl = new URL(
    `https://api.vercel.com/v10/projects/${projectId}/env`,
  );
  createUrl.searchParams.set("teamId", teamId);

  const createRes = await fetch(createUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: targets,
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Could not create Vercel env var ${key}.`);
  }
  return { action: "created" as const, key };
}
