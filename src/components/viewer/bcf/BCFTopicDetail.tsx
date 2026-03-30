import { useState } from "react";
import {
  ArrowLeft,
  Camera,
  MessageSquare,
  Send,
  Trash2,
} from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";
import { PanelBadge } from "@/components/ui/PanelBadge";
import { IconActionButton } from "@/components/ui/IconActionButton";
import type { BcfTopic, BcfViewpoint } from "@/services/bcfService";

interface BCFTopicDetailProps {
  topic: BcfTopic;
  onBack: () => void;
  onAddComment: (text: string) => void;
  onDeleteTopic: () => void;
  onActivateViewpoint: (viewpoint: BcfViewpoint) => void;
  onCaptureViewpoint: () => void;
}

export function BCFTopicDetail({
  topic,
  onBack,
  onAddComment,
  onDeleteTopic,
  onActivateViewpoint,
  onCaptureViewpoint,
}: BCFTopicDetailProps) {
  const [commentText, setCommentText] = useState("");

  const handleSubmitComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    onAddComment(trimmed);
    setCommentText("");
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <IconActionButton
          icon={<ArrowLeft size={14} />}
          iconOnly
          onClick={onBack}
          aria-label="목록으로 돌아가기"
        />
        <strong className="flex-1 truncate text-[0.88rem] text-text">
          {topic.title}
        </strong>
        <IconActionButton
          icon={<Trash2 size={14} />}
          iconOnly
          variant="danger"
          onClick={onDeleteTopic}
          aria-label="토픽 삭제"
        />
      </div>

      <PanelCard title="Info" variant="soft">
        <div className="grid gap-1.5 text-[0.76rem]">
          <div className="flex justify-between">
            <span className="text-text-muted">Status</span>
            <PanelBadge variant={topic.topicStatus === "Closed" ? "success" : "info"}>
              {topic.topicStatus || "Open"}
            </PanelBadge>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Type</span>
            <span className="text-text">{topic.topicType || "Issue"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Priority</span>
            <span className="text-text">{topic.priority || "Normal"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Author</span>
            <span className="text-text">{topic.creationAuthor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Created</span>
            <span className="text-text">
              {new Date(topic.creationDate).toLocaleString()}
            </span>
          </div>
          {topic.assignedTo ? (
            <div className="flex justify-between">
              <span className="text-text-muted">Assigned</span>
              <span className="text-text">{topic.assignedTo}</span>
            </div>
          ) : null}
        </div>
        {topic.description ? (
          <p className="mt-2 border-t border-border-subtle pt-2 text-[0.76rem] leading-relaxed text-text-secondary">
            {topic.description}
          </p>
        ) : null}
      </PanelCard>

      {/* Viewpoints */}
      <PanelCard
        title="Viewpoints"
        description={`${topic.viewpoints.length}개`}
        actions={
          <IconActionButton
            icon={<Camera size={14} />}
            label="현재 뷰 캡처"
            onClick={onCaptureViewpoint}
          >
            Capture
          </IconActionButton>
        }
      >
        {topic.viewpoints.length === 0 ? (
          <p className="text-[0.76rem] text-text-muted">뷰포인트가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {topic.viewpoints.map((vp) => (
              <button
                key={vp.guid}
                type="button"
                className="overflow-hidden rounded-lg border border-border-subtle transition-colors hover:border-primary/30"
                onClick={() => onActivateViewpoint(vp)}
              >
                {vp.snapshotBase64 ? (
                  <img
                    src={vp.snapshotBase64}
                    alt="Viewpoint snapshot"
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-slate-50 text-[0.68rem] text-text-muted dark:bg-slate-800">
                    No snapshot
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </PanelCard>

      {/* Comments */}
      <PanelCard
        title="Comments"
        description={`${topic.comments.length}개`}
      >
        {topic.comments.length > 0 ? (
          <div className="grid gap-2">
            {topic.comments.map((comment) => (
              <div
                key={comment.guid}
                className="rounded-lg border border-border-subtle px-3 py-2"
              >
                <div className="flex items-center gap-2 text-[0.68rem] text-text-muted">
                  <MessageSquare size={10} />
                  <span className="font-bold">{comment.author}</span>
                  <span>·</span>
                  <span>{new Date(comment.date).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[0.78rem] leading-relaxed text-text">
                  {comment.comment}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <input
            type="text"
            className="field-control-element flex-1 rounded border border-border-subtle px-2.5 py-1.5 text-[0.78rem]"
            placeholder="코멘트 입력..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmitComment();
            }}
          />
          <IconActionButton
            icon={<Send size={14} />}
            iconOnly
            onClick={handleSubmitComment}
            disabled={!commentText.trim()}
            aria-label="코멘트 전송"
          />
        </div>
      </PanelCard>
    </div>
  );
}
