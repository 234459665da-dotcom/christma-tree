import { create } from 'zustand';
import { AppMode, GestureType, HandState, Photo } from './types';

interface AppState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  
  handState: HandState;
  setHandState: (state: Partial<HandState>) => void;
  
  photos: Photo[];
  addPhoto: (url: string) => void;
  focusedPhotoId: string | null;
  setFocusedPhotoId: (id: string | null) => void;

  cameraRotation: { x: number, y: number };
  setCameraRotation: (rot: { x: number, y: number }) => void;
}

// Generate some initial random photos
const INITIAL_PHOTOS: Photo[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `photo-${i}`,
  url: `https://picsum.photos/seed/${i + 100}/400/400`,
  position: [0, 0, 0], 
  rotation: [0, 0, 0]
}));

export const useStore = create<AppState>((set) => ({
  mode: AppMode.TREE,
  setMode: (mode) => set({ mode }),

  handState: {
    present: false,
    gesture: GestureType.NONE,
    x: 0.5,
    y: 0.5,
    pinchDistance: 1
  },
  setHandState: (updates) => set((state) => ({ 
    handState: { ...state.handState, ...updates } 
  })),

  photos: INITIAL_PHOTOS,
  addPhoto: (url) => set((state) => ({
    photos: [
      ...state.photos,
      {
        id: `user-${Date.now()}`,
        url,
        position: [0, 0, 0],
        rotation: [0, 0, 0]
      }
    ]
  })),

  focusedPhotoId: null,
  setFocusedPhotoId: (id) => set({ focusedPhotoId: id }),

  cameraRotation: { x: 0, y: 0 },
  setCameraRotation: (rot) => set({ cameraRotation: rot })
}));