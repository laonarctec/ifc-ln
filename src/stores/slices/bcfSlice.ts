import type { StateCreator } from 'zustand';
import type {
  BcfProject,
  BcfTopic,
  BcfComment,
  BcfViewpoint,
} from '@/services/bcfService';

export interface BcfSlice {
  bcfProject: BcfProject | null;
  bcfSelectedTopicGuid: string | null;
  bcfAuthor: string;
  setBcfProject: (project: BcfProject | null) => void;
  setBcfSelectedTopicGuid: (guid: string | null) => void;
  setBcfAuthor: (author: string) => void;
  addBcfTopic: (topic: BcfTopic) => void;
  updateBcfTopic: (guid: string, updates: Partial<BcfTopic>) => void;
  deleteBcfTopic: (guid: string) => void;
  addBcfComment: (topicGuid: string, comment: BcfComment) => void;
  addBcfViewpoint: (topicGuid: string, viewpoint: BcfViewpoint) => void;
}

function updateTopicInProject(
  project: BcfProject,
  topicGuid: string,
  updater: (topic: BcfTopic) => BcfTopic,
): BcfProject {
  return {
    ...project,
    topics: project.topics.map((t) => (t.guid === topicGuid ? updater(t) : t)),
  };
}

export const createBcfSlice: StateCreator<BcfSlice, [], [], BcfSlice> = (set) => ({
  bcfProject: null,
  bcfSelectedTopicGuid: null,
  bcfAuthor: 'User',

  setBcfProject: (bcfProject) => set({ bcfProject, bcfSelectedTopicGuid: null }),
  setBcfSelectedTopicGuid: (bcfSelectedTopicGuid) => set({ bcfSelectedTopicGuid }),
  setBcfAuthor: (bcfAuthor) => set({ bcfAuthor }),

  addBcfTopic: (topic) =>
    set((state) => {
      const project = state.bcfProject ?? {
        projectId: 'default',
        projectName: 'BCF Project',
        topics: [],
      };
      return {
        bcfProject: { ...project, topics: [...project.topics, topic] },
        bcfSelectedTopicGuid: topic.guid,
      };
    }),

  updateBcfTopic: (guid, updates) =>
    set((state) => {
      if (!state.bcfProject) return state;
      return {
        bcfProject: updateTopicInProject(state.bcfProject, guid, (t) => ({
          ...t,
          ...updates,
          modifiedDate: new Date().toISOString(),
        })),
      };
    }),

  deleteBcfTopic: (guid) =>
    set((state) => {
      if (!state.bcfProject) return state;
      return {
        bcfProject: {
          ...state.bcfProject,
          topics: state.bcfProject.topics.filter((t) => t.guid !== guid),
        },
        bcfSelectedTopicGuid:
          state.bcfSelectedTopicGuid === guid ? null : state.bcfSelectedTopicGuid,
      };
    }),

  addBcfComment: (topicGuid, comment) =>
    set((state) => {
      if (!state.bcfProject) return state;
      return {
        bcfProject: updateTopicInProject(state.bcfProject, topicGuid, (t) => ({
          ...t,
          comments: [...t.comments, comment],
        })),
      };
    }),

  addBcfViewpoint: (topicGuid, viewpoint) =>
    set((state) => {
      if (!state.bcfProject) return state;
      return {
        bcfProject: updateTopicInProject(state.bcfProject, topicGuid, (t) => ({
          ...t,
          viewpoints: [...t.viewpoints, viewpoint],
        })),
      };
    }),
});
