import { defineConfig } from "@prisma/config";

export default defineConfig({
  datasource: {
    // Hardcoding the Docker database URL so Windows can't block it
   url: process.env.DATABASE_URL as string,
  },
});