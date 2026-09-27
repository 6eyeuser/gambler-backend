import { defineConfig } from "@prisma/config";

export default defineConfig({
  datasource: {
    // Hardcoding the Docker database URL so Windows can't block it
    url: "postgresql://gambler_admin:local_password@localhost:5434/gambler?schema=public",
  },
});