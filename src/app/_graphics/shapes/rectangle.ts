/*
 * <<licensetext>>
 */
import Konva from 'konva';
import { Group } from 'konva/lib/Group';
import { Shape, ShapeConfig } from 'konva/lib/Shape';
import { Colors } from 'src/app/_constants/colors';
import { Selectable, SelectableShape } from 'src/app/_interfaces/selectable';
import { ShapeType } from 'src/app/_models/shape-type';

export class RectangleShape extends Konva.Shape implements Selectable {
  stage: Konva.Stage;
  groupId: string = '';
  isSelected: boolean = false;
  group?: Konva.Group;
  zoomLevel: number;

  constructor(
    stage: Konva.Stage,
    x: number,
    y: number,
    width: number,
    height: number,
    draggable = false,
    zoomLevel: number,
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
    this.zoomLevel = zoomLevel;
  }

  drawShape(layer: Konva.Layer) {
    layer.add(this);
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
