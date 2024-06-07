/*
 * <<licensetext>>
 */
import Konva from 'konva';
import { Shape, ShapeConfig } from 'konva/lib/Shape';
import { Selectable, SelectableShape } from 'src/app/_interfaces/selectable';

export class GroupRectangleShape extends Konva.Shape implements Selectable {
  stage: Konva.Stage;
  groupId: string = '';
  isSelected: boolean = false;
  group?: Konva.Group;
  count: number;
  numberText: Konva.Text | null = null;
  subShapes: Konva.Shape[] = [];

  constructor(
    stage: Konva.Stage,
    x: number,
    y: number,
    width: number,
    height: number,
    draggable = false,
    count: number,
    subShapes: Konva.Shape[]
  ) {
    super({x: 10,
      y: 20,
      fill: '#00D2FF',
      width: 100,
      height: 50,
      stroke: 'black',
      strokeWidth: 4,
      sceneFunc: function (context, shape) {
        context.beginPath();
        context.rect(0, 0, shape.getAttr('width'), shape.getAttr('height'));
        context.fillStrokeShape(shape);
      }} as ShapeConfig);
    this.stage = stage;
    this.setAttrs({ x, y, width, height, draggable });
    this.count = count;
    this.subShapes = subShapes;
  }

  drawShape(layer: Konva.Layer, shapeSizeX: number, shapeSizeY: number) {
    layer.add(this);

    this.numberText = new Konva.Text({
        x: this.x()+shapeSizeX/4, 
        y: this.y()+shapeSizeY/4, 
        text: this.count.toString(), 
        fontSize: 20,
        fill: 'black',
        listening: false
      });
      layer.add(this.numberText);
  }

  override destroy(): this {
    // If numberText exists, destroy it
    if (this.numberText) {
      this.numberText.destroy();
    }
    // Call the superclass destroy method
    return super.destroy();
  }

  selectShape() {
    this.stroke('yellow');
    this.isSelected = true;
  }

  unselectShape() {
    this.stroke('black');
    this.isSelected = false;
  }
}
