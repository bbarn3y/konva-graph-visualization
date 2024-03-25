import Konva from "konva";
import { Shape } from "konva/lib/Shape";

export class Selectable {

  isSelected: boolean = false;

  selectShape() {}

  unselectShape() {}
}

export abstract class SelectableShape extends Shape {
  isSelected: boolean = false;

  abstract selectShape(): void;

  abstract unselectShape(): void;
}
