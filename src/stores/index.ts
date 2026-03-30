import { create } from 'zustand';
import { createBcfSlice, type BcfSlice } from './slices/bcfSlice';
import { createChangesSlice, type ChangesSlice } from './slices/changesSlice';
import { createIdsSlice, type IdsSlice } from './slices/idsSlice';
import { createListSlice, type ListSlice } from './slices/listSlice';
import { createScriptSlice, type ScriptSlice } from './slices/scriptSlice';
import { createClippingSlice, type ClippingSlice } from './slices/clippingSlice';
import { createDataSlice, type DataSlice } from './slices/dataSlice';
import { createLensSlice, type LensSlice } from './slices/lensSlice';
import { createLoadingSlice, type LoadingSlice } from './slices/loadingSlice';
import { createSelectionSlice, type SelectionSlice } from './slices/selectionSlice';
import { createToolsSlice, type ToolsSlice } from './slices/toolsSlice';
import { createUISlice, type UISlice } from './slices/uiSlice';
import { createVisibilitySlice, type VisibilitySlice } from './slices/visibilitySlice';

export type ViewerState = UISlice & LoadingSlice & DataSlice & SelectionSlice & VisibilitySlice & ToolsSlice & ChangesSlice & LensSlice & ClippingSlice & BcfSlice & IdsSlice & ListSlice & ScriptSlice;

export const useViewerStore = create<ViewerState>()((...args) => ({
  ...createUISlice(...args),
  ...createLoadingSlice(...args),
  ...createDataSlice(...args),
  ...createSelectionSlice(...args),
  ...createVisibilitySlice(...args),
  ...createToolsSlice(...args),
  ...createChangesSlice(...args),
  ...createLensSlice(...args),
  ...createClippingSlice(...args),
  ...createBcfSlice(...args),
  ...createIdsSlice(...args),
  ...createListSlice(...args),
  ...createScriptSlice(...args),
}));
