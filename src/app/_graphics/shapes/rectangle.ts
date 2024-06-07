/*
 * <<licensetext>>
 */
import Konva from 'konva';
import { ShapeConfig } from 'konva/lib/Shape';
import { Connectable, ConnectionData } from 'src/app/_interfaces/connectable';
import { Selectable } from 'src/app/_interfaces/selectable';

export class RectangleShape extends Konva.Shape implements Selectable, Connectable {
  stage: Konva.Stage;
  groupId: string = '';
  isSelected: boolean = false;
  group?: Konva.Group;
  zoomLevel: number;
  connections: ConnectionData[] = [];

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

  addConnection(connectionData: ConnectionData): void {
    this.connections.push(connectionData);
    console.log('Connection added!', connectionData, this.connections);
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
