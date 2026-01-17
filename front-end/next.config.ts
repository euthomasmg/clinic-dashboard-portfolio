import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  async rewrites() {
    return [
      {
        source: "/dashboard/patients/:patientId",
        destination: "/dashboard/patients/id?patientId=:patientId",
      },
    ];
  },
};

export default nextConfig;
