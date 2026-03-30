import { useCallback } from "react";
import {
  Bookmark,
  Code2,
  Play,
  Save,
  Trash2,
} from "lucide-react";
import { IconActionButton } from "@/components/ui/IconActionButton";
import { useViewerStore } from "@/stores";

export function ScriptPanel() {
  const code = useViewerStore((s) => s.scriptCode);
  const logs = useViewerStore((s) => s.scriptLogs);
  const savedScripts = useViewerStore((s) => s.savedScripts);
  const running = useViewerStore((s) => s.scriptRunning);
  const setCode = useViewerStore((s) => s.setScriptCode);
  const addLog = useViewerStore((s) => s.addScriptLog);
  const clearLogs = useViewerStore((s) => s.clearScriptLogs);
  const saveScript = useViewerStore((s) => s.saveScript);
  const loadScript = useViewerStore((s) => s.loadScript);
  const deleteScript = useViewerStore((s) => s.deleteScript);
  const setRunning = useViewerStore((s) => s.setScriptRunning);

  const handleRun = useCallback(() => {
    setRunning(true);
    clearLogs();

    try {
      // Capture console.log output
      const originalLog = console.log;
      const originalError = console.error;
      const capturedLogs: typeof logs = [];

      console.log = (...args: unknown[]) => {
        capturedLogs.push({
          type: "log",
          text: args.map(String).join(" "),
          timestamp: new Date().toISOString(),
        });
        originalLog(...args);
      };
      console.error = (...args: unknown[]) => {
        capturedLogs.push({
          type: "error",
          text: args.map(String).join(" "),
          timestamp: new Date().toISOString(),
        });
        originalError(...args);
      };

      // Execute the script
      const fn = new Function(code);
      const result = fn();

      // Restore console
      console.log = originalLog;
      console.error = originalError;

      for (const log of capturedLogs) addLog(log);

      if (result !== undefined) {
        addLog({
          type: "result",
          text: String(result),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      addLog({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      });
    }

    setRunning(false);
  }, [addLog, clearLogs, code, setRunning]);

  const handleSave = useCallback(() => {
    const name = `Script ${savedScripts.length + 1}`;
    saveScript(name);
  }, [saveScript, savedScripts.length]);

  return (
    <div className="flex h-full w-full flex-col bg-white/88 dark:bg-slate-800/88">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-2">
        <Code2 size={16} className="text-text-muted" />
        <span className="text-[0.78rem] font-bold uppercase tracking-wide text-text-secondary">
          Script
        </span>
        <div className="flex flex-1 items-center justify-end gap-2">
          <IconActionButton
            icon={<Play size={13} />}
            onClick={handleRun}
            disabled={running || !code.trim()}
          >
            Run
          </IconActionButton>
          <IconActionButton icon={<Save size={13} />} onClick={handleSave}>
            Save
          </IconActionButton>
          <IconActionButton icon={<Trash2 size={13} />} onClick={clearLogs} variant="danger">
            Clear
          </IconActionButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Saved scripts sidebar */}
        {savedScripts.length > 0 ? (
          <div className="flex w-[160px] shrink-0 flex-col border-r border-border-subtle overflow-auto">
            <div className="px-3 py-2">
              <span className="text-[0.66rem] font-bold uppercase tracking-wide text-text-muted">
                <Bookmark size={10} className="mr-1 inline" />
                Saved
              </span>
            </div>
            <div className="grid gap-0.5 px-2">
              {savedScripts.map((script) => (
                <div
                  key={script.id}
                  className="flex items-center justify-between rounded px-2 py-1"
                >
                  <button
                    type="button"
                    className="flex-1 truncate text-left text-[0.72rem] text-text hover:text-primary"
                    onClick={() => loadScript(script.id)}
                  >
                    {script.name}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 opacity-40 hover:opacity-100"
                    onClick={() => deleteScript(script.id)}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Editor */}
        <div className="flex flex-1 flex-col">
          <textarea
            className="flex-1 resize-none border-0 bg-slate-50 px-4 py-3 font-mono text-[0.78rem] text-text outline-none dark:bg-slate-900 dark:text-slate-200"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            placeholder="// JavaScript 코드를 작성하세요..."
          />

          {/* Console output */}
          {logs.length > 0 ? (
            <div className="max-h-[120px] overflow-auto border-t border-border-subtle bg-slate-950 px-4 py-2">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`font-mono text-[0.72rem] leading-relaxed ${
                    log.type === "error"
                      ? "text-red-400"
                      : log.type === "result"
                        ? "text-green-400"
                        : "text-slate-300"
                  }`}
                >
                  <span className="mr-2 opacity-40">
                    {log.type === "error" ? "✗" : log.type === "result" ? "→" : "›"}
                  </span>
                  {log.text}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
