/*
 * <<licensetext>>
 */

export enum SnapDirection {
  start = 'start',
  center = 'center',
  end = 'end',
}

export enum GuideOrientation {
  V = 'V',
  H = 'H',
}

export interface ObjectBound {
  guide: number;
  offset: number;
  snap: SnapDirection;
}

export interface ObjectSnappingEdges {
  vertical: ObjectBound[];
  horizontal: ObjectBound[];
}

export interface LineGuideStops {
  vertical: number[];
  horizontal: number[];
}

export interface LineGuide {
  lineGuide: number;
  diff: number;
  snap: SnapDirection;
  offset: number;
}

export interface FinalLineGuide {
  lineGuide: number;
  offset: number;
  orientation: GuideOrientation;
  snap: SnapDirection;
}
