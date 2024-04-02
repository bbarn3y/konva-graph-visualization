import Konva from "konva";
import { Shape } from "konva/lib/Shape";

export interface Selectable {

  isSelected: boolean;

  selectShape(): void;

  unselectShape(): void;
}

export abstract class SelectableShape extends Shape {
  isSelected: boolean = false;

  abstract selectShape(): void;

  abstract unselectShape(): void;
}
