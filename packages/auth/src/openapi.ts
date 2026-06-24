import { auth } from "./index";

type AuthOpenAPISchema = Awaited<ReturnType<typeof auth.api.generateOpenAPISchema>>;

let schemaPromise: Promise<AuthOpenAPISchema> | null = null;

function getSchema() {
  schemaPromise ??= auth.api.generateOpenAPISchema();
  return schemaPromise;
}

export const authOpenAPI = {
  getPaths: async (prefix = "/api/auth") => {
    const { paths } = await getSchema();
    const reference: Record<string, (typeof paths)[string]> = {};

    for (const path of Object.keys(paths)) {
      const source = paths[path];
      if (!source) continue;

      const key = `${prefix}${path}`;
      reference[key] = { ...source };

      for (const method of Object.keys(source)) {
        const operation = (reference[key] as Record<string, Record<string, unknown>>)[method];
        if (operation) {
          operation.tags = ["Better Auth"];
        }
      }
    }

    return reference;
  },
  getComponents: async () => {
    const { components } = await getSchema();
    return components;
  },
} as const;
