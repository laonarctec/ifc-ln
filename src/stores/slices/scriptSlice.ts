import type { StateCreator } from 'zustand';

export interface SavedScript {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface ScriptLogEntry {
  type: 'log' | 'error' | 'result';
  text: string;
  timestamp: string;
}

export interface ScriptSlice {
  scriptCode: string;
  scriptLogs: ScriptLogEntry[];
  savedScripts: SavedScript[];
  scriptRunning: boolean;
  setScriptCode: (code: string) => void;
  addScriptLog: (entry: ScriptLogEntry) => void;
  clearScriptLogs: () => void;
  saveScript: (name: string) => void;
  loadScript: (id: string) => void;
  deleteScript: (id: string) => void;
  setScriptRunning: (running: boolean) => void;
}

export const createScriptSlice: StateCreator<ScriptSlice, [], [], ScriptSlice> = (set, get) => ({
  scriptCode: '// BIM script\nconsole.log("Hello, IFC!");\n',
  scriptLogs: [],
  savedScripts: [],
  scriptRunning: false,

  setScriptCode: (scriptCode) => set({ scriptCode }),
  addScriptLog: (entry) =>
    set((state) => ({ scriptLogs: [...state.scriptLogs, entry] })),
  clearScriptLogs: () => set({ scriptLogs: [] }),
  saveScript: (name) => {
    const code = get().scriptCode;
    const id = `script-${Date.now()}`;
    set((state) => ({
      savedScripts: [
        ...state.savedScripts,
        { id, name, code, createdAt: new Date().toISOString() },
      ],
    }));
  },
  loadScript: (id) => {
    const script = get().savedScripts.find((s) => s.id === id);
    if (script) set({ scriptCode: script.code });
  },
  deleteScript: (id) =>
    set((state) => ({
      savedScripts: state.savedScripts.filter((s) => s.id !== id),
    })),
  setScriptRunning: (scriptRunning) => set({ scriptRunning }),
});
