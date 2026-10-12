import SidePanel from "@/components/SidePanel";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen gap-2 bg-zinc-200 p-2">
      <SidePanel />
      {/* min-w-0 lets the chart shrink when the panel expands. */}
      <main className="min-w-0 flex-1 overflow-y-auto rounded-lg bg-white p-8 shadow-sm">
        {children}
      </main>
    </div>
  );
}
