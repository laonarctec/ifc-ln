import { useCallback, useRef, type ChangeEvent, type MutableRefObject } from "react";
import {
  type ViewerNotificationPort,
  viewerNotificationPort,
} from "./viewerPorts";

interface ToolbarFileActionsContext {
  loadFile: (file: File) => Promise<void>;
  resetSession: () => Promise<void>;
  notificationPort?: ViewerNotificationPort;
}

export interface ToolbarFileActions {
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  addModelInputRef: MutableRefObject<HTMLInputElement | null>;
  handleOpenFile: () => void;
  handleAddModel: () => void;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAddModelChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function useToolbarFileActions(
  ctx: ToolbarFileActionsContext,
): ToolbarFileActions {
  const {
    loadFile,
    resetSession,
    notificationPort = viewerNotificationPort,
  } = ctx;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addModelInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAddModel = useCallback(() => {
    addModelInputRef.current?.click();
  }, []);

  const loadSelectedFiles = useCallback(
    async ({
      files,
      resetBeforeLoad,
      successMessage,
      errorPrefix,
    }: {
      files: File[];
      resetBeforeLoad: boolean;
      successMessage: (count: number) => string;
      errorPrefix: string;
    }) => {
      if (files.length === 0) {
        return;
      }

      try {
        if (resetBeforeLoad) {
          await resetSession();
        }

        for (const file of files) {
          await loadFile(file);
        }

        notificationPort.success(successMessage(files.length));
      } catch (error) {
        console.error(error);
        notificationPort.error(
          `${errorPrefix}: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        );
      }
    },
    [loadFile, notificationPort, resetSession],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      try {
        await loadSelectedFiles({
          files,
          resetBeforeLoad: true,
          successMessage: (count) => `${count}개 IFC 로딩 완료`,
          errorPrefix: "파일 로딩 실패",
        });
      } finally {
        event.target.value = "";
      }
    },
    [loadSelectedFiles],
  );

  const handleAddModelChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      try {
        await loadSelectedFiles({
          files,
          resetBeforeLoad: false,
          successMessage: (count) => `${count}개 모델 추가 완료`,
          errorPrefix: "모델 추가 실패",
        });
      } finally {
        event.target.value = "";
      }
    },
    [loadSelectedFiles],
  );

  return {
    fileInputRef,
    addModelInputRef,
    handleOpenFile,
    handleAddModel,
    handleFileChange,
    handleAddModelChange,
  };
}
