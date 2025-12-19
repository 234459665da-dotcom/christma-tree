export enum AppMode {
  TREE = 'TREE',
  SCATTER = 'SCATTER',
  FOCUS = 'FOCUS'
}

export enum GestureType {
  NONE = 'NONE',
  OPEN_HAND = 'OPEN_HAND',
  FIST = 'FIST',
  PINCH = 'PINCH'
}

export interface Photo {
  id: string;
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

export interface HandState {
  present: boolean;
  gesture: GestureType;
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  pinchDistance: number;
}