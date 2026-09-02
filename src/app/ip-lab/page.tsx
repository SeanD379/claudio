import type { Metadata } from "next";
import { IpLab } from "./IpLab";

export const metadata: Metadata = {
  title: "Claudio IP Lab",
  description: "Claudio 独立 IP 角色概念测试页",
};

export default function IpLabPage() {
  return <IpLab />;
}
