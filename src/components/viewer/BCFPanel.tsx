import { useCallback, useRef, useState } from "react";
import {
  Download,
  MessageSquare,
  Plus,
  Upload,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconActionButton } from "@/components/ui/IconActionButton";
import { useViewerStore } from "@/stores";
import {
  importBcfZip,
  exportBcfZip,
  createEmptyTopic,
  createComment,
  type BcfViewpoint,
} from "@/services/bcfService";
import { threeCameraToBcfViewpoint } from "@/services/bcfViewpoint";
import { BCFTopicList } from "./bcf/BCFTopicList";
import { BCFTopicDetail } from "./bcf/BCFTopicDetail";
import { BCFCreateTopicForm } from "./bcf/BCFCreateTopicForm";

export function BCFPanel() {
  const bcfProject = useViewerStore((s) => s.bcfProject);
  const selectedGuid = useViewerStore((s) => s.bcfSelectedTopicGuid);
  const author = useViewerStore((s) => s.bcfAuthor);
  const setBcfProject = useViewerStore((s) => s.setBcfProject);
  const setSelectedGuid = useViewerStore((s) => s.setBcfSelectedTopicGuid);
  const addTopic = useViewerStore((s) => s.addBcfTopic);
  const deleteTopic = useViewerStore((s) => s.deleteBcfTopic);
  const addComment = useViewerStore((s) => s.addBcfComment);
  const addViewpoint = useViewerStore((s) => s.addBcfViewpoint);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const topics = bcfProject?.topics ?? [];
  const selectedTopic = topics.find((t) => t.guid === selectedGuid) ?? null;

  const handleImport = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const project = await importBcfZip(file);
        setBcfProject(project);
      } catch (err) {
        console.error("BCF import failed:", err);
      }
      e.target.value = "";
    },
    [setBcfProject],
  );

  const handleExport = useCallback(async () => {
    if (!bcfProject) return;
    try {
      const blob = await exportBcfZip(bcfProject);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bcfProject.projectName}.bcfzip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("BCF export failed:", err);
    }
  }, [bcfProject]);

  const handleCreateTopic = useCallback(
    (title: string, description: string) => {
      addTopic(createEmptyTopic(title, description, author));
      setShowCreateForm(false);
    },
    [addTopic, author],
  );

  const handleAddComment = useCallback(
    (text: string) => {
      if (!selectedGuid) return;
      addComment(selectedGuid, createComment(text, author));
    },
    [addComment, author, selectedGuid],
  );

  const handleCaptureViewpoint = useCallback(() => {
    if (!selectedGuid) return;
    // Capture current Three.js camera state
    const canvas = document.querySelector("canvas");
    const snapshotBase64 = canvas?.toDataURL("image/png");

    // TODO: get actual camera state from Three.js scene
    const camera = threeCameraToBcfViewpoint({
      position: { x: 0, y: 5, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      fov: 60,
      isPerspective: true,
    });

    const vp: BcfViewpoint = {
      guid: crypto.randomUUID(),
      camera,
      snapshotBase64,
    };
    addViewpoint(selectedGuid, vp);
  }, [addViewpoint, selectedGuid]);

  const handleActivateViewpoint = useCallback((_vp: BcfViewpoint) => {
    // TODO: apply BCF viewpoint to Three.js camera
  }, []);

  return (
    <aside className="panel panel-right">
      <input
        ref={fileInputRef}
        type="file"
        accept=".bcf,.bcfzip"
        className="hidden"
        onChange={(e) => { void handleFileChange(e); }}
      />
      <div className="panel-header">
        <div className="flex items-center justify-between gap-3">
          <span>BCF</span>
          <small className="text-text-muted text-[0.7rem] normal-case tracking-normal dark:text-slate-400">
            {bcfProject?.projectName ?? "No project"}
          </small>
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden p-3.5 pr-2 text-text-secondary">
        <div className="grid min-h-0 gap-3.5 overflow-auto pr-1.5 align-content-start">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <IconActionButton
              icon={<Upload size={14} />}
              onClick={() => { void handleImport(); }}
            >
              Import
            </IconActionButton>
            <IconActionButton
              icon={<Download size={14} />}
              onClick={() => { void handleExport(); }}
              disabled={!bcfProject || topics.length === 0}
            >
              Export
            </IconActionButton>
            <IconActionButton
              icon={<Plus size={14} />}
              onClick={() => {
                setShowCreateForm(true);
                setSelectedGuid(null);
              }}
            >
              New Topic
            </IconActionButton>
          </div>

          {showCreateForm ? (
            <BCFCreateTopicForm
              onSubmit={handleCreateTopic}
              onCancel={() => setShowCreateForm(false)}
            />
          ) : null}

          {selectedTopic ? (
            <BCFTopicDetail
              topic={selectedTopic}
              onBack={() => setSelectedGuid(null)}
              onAddComment={handleAddComment}
              onDeleteTopic={() => deleteTopic(selectedTopic.guid)}
              onActivateViewpoint={handleActivateViewpoint}
              onCaptureViewpoint={handleCaptureViewpoint}
            />
          ) : topics.length > 0 ? (
            <BCFTopicList
              topics={topics}
              selectedGuid={selectedGuid}
              onSelect={setSelectedGuid}
            />
          ) : !showCreateForm ? (
            <EmptyState
              icon={<MessageSquare size={16} />}
              title="BIM Collaboration Format"
              description="BCF 파일을 가져오거나 새 이슈를 만들어 모델에 대한 토픽을 관리합니다."
            />
          ) : null}
        </div>
      </div>

      <div className="panel-footer">
        <span>BCF</span>
        <span>{topics.length} topics</span>
      </div>
    </aside>
  );
}
