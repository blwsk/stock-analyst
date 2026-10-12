import WorkspaceView from "@/components/WorkspaceView";

export default async function WorkspacePage(
  props: PageProps<"/workspace/[id]">
) {
  const { id } = await props.params;
  return <WorkspaceView id={id} />;
}
