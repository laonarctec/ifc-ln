import type { StateCreator } from 'zustand';
import type { IdsDocument, IdsSpecification } from '@/services/idsParser';

export type IdsValidationStatus = 'pass' | 'fail' | 'not-applicable';

export interface IdsEntityResult {
  entityExpressId: number;
  entityName: string;
  entityType: string;
  status: IdsValidationStatus;
  requirementResults: {
    requirementIndex: number;
    status: IdsValidationStatus;
    message: string;
  }[];
}

export interface IdsSpecificationResult {
  specificationIndex: number;
  specification: IdsSpecification;
  entityResults: IdsEntityResult[];
  passCount: number;
  failCount: number;
}

export interface IdsSlice {
  idsDocument: IdsDocument | null;
  idsResults: IdsSpecificationResult[];
  idsSelectedSpecIndex: number | null;
  idsValidating: boolean;
  idsStatusFilter: IdsValidationStatus | 'all';
  setIdsDocument: (doc: IdsDocument | null) => void;
  setIdsResults: (results: IdsSpecificationResult[]) => void;
  setIdsSelectedSpecIndex: (index: number | null) => void;
  setIdsValidating: (validating: boolean) => void;
  setIdsStatusFilter: (filter: IdsValidationStatus | 'all') => void;
  clearIds: () => void;
}

export const createIdsSlice: StateCreator<IdsSlice, [], [], IdsSlice> = (set) => ({
  idsDocument: null,
  idsResults: [],
  idsSelectedSpecIndex: null,
  idsValidating: false,
  idsStatusFilter: 'all',

  setIdsDocument: (idsDocument) => set({ idsDocument, idsResults: [], idsSelectedSpecIndex: null }),
  setIdsResults: (idsResults) => set({ idsResults, idsValidating: false }),
  setIdsSelectedSpecIndex: (idsSelectedSpecIndex) => set({ idsSelectedSpecIndex }),
  setIdsValidating: (idsValidating) => set({ idsValidating }),
  setIdsStatusFilter: (idsStatusFilter) => set({ idsStatusFilter }),
  clearIds: () => set({
    idsDocument: null,
    idsResults: [],
    idsSelectedSpecIndex: null,
    idsValidating: false,
    idsStatusFilter: 'all',
  }),
});
