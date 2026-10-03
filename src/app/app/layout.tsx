import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false },
};

export default function WorkspaceLayout({ children }: LayoutProps<"/app">) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
