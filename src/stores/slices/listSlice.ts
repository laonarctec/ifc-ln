import type { StateCreator } from 'zustand';

export interface ListColumn {
  field: string;
  label: string;
}

export interface ListDefinition {
  id: string;
  name: string;
  entityTypeFilter: string;
  columns: ListColumn[];
}

export interface ListResultRow {
  entityExpressId: number;
  values: Record<string, string>;
}

export interface ListSlice {
  listDefinitions: ListDefinition[];
  activeListId: string | null;
  listResults: ListResultRow[];
  listLoading: boolean;
  addListDefinition: (def: ListDefinition) => void;
  updateListDefinition: (id: string, patch: Partial<ListDefinition>) => void;
  removeListDefinition: (id: string) => void;
  setActiveListId: (id: string | null) => void;
  setListResults: (results: ListResultRow[]) => void;
  setListLoading: (loading: boolean) => void;
}

export const createListSlice: StateCreator<ListSlice, [], [], ListSlice> = (set) => ({
  listDefinitions: [],
  activeListId: null,
  listResults: [],
  listLoading: false,

  addListDefinition: (def) =>
    set((state) => ({
      listDefinitions: [...state.listDefinitions, def],
      activeListId: def.id,
    })),
  updateListDefinition: (id, patch) =>
    set((state) => ({
      listDefinitions: state.listDefinitions.map((d) =>
        d.id === id ? { ...d, ...patch } : d,
      ),
    })),
  removeListDefinition: (id) =>
    set((state) => ({
      listDefinitions: state.listDefinitions.filter((d) => d.id !== id),
      activeListId: state.activeListId === id ? null : state.activeListId,
    })),
  setActiveListId: (activeListId) => set({ activeListId }),
  setListResults: (listResults) => set({ listResults, listLoading: false }),
  setListLoading: (listLoading) => set({ listLoading }),
});
