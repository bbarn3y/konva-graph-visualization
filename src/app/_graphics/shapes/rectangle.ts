/*
 * <<licensetext>>
 */
import Konva from 'konva';
import { Shape, ShapeConfig } from 'konva/lib/Shape';
import { Colors } from 'src/app/_constants/colors';
import { Selectable, SelectableShape } from 'src/app/_interfaces/selectable';
import { ShapeType } from 'src/app/_models/shape-type';

export class RectangleShape extends SelectableShape {
  stage: Konva.Stage;
  // override x: number;
  // override y: number;
  // width: number;
  // height: number;
  // draggable: boolean;
  // id?: number;
  groupId: string = '';
  //isSelected: boolean = false;

  constructor(
    stage: Konva.Stage,
    x: number,
    y: number,
    width: number,
    height: number,
    draggable = false,
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
        // don't need to set position of rect, Konva will handle it
        context.rect(0, 0, shape.getAttr('width'), shape.getAttr('height'));
        // (!) Konva specific method, it is very important
        // it will apply are required styles
        context.fillStrokeShape(shape);
      }} as ShapeConfig);
    this.stage = stage;
    this.setAttrs({ x, y, width, height, draggable });
    // this.x = x;
    // this.y = y;
    // this.width = width;
    // this.height = height;
    // this.draggable = draggable;

    console.log("CONTRUCTOR " + JSON.stringify(this)); 
  }

  drawShape(layer: Konva.Layer) {
    layer.add(this);
  }

  // shape() {
  //   const rect = new Konva.Rect({
  //     x: this.x(),
  //     y: this.y(),
  //     width: this.width(),
  //     height: this.height(),
  //     draggable: this.draggable(),
  //     // x: this.x,
  //     // y: this.y,
  //     // width: this.width,
  //     // height: this.height,
  //     fill: Colors.defaultBg,
  //     stroke: 'black',
  //     strokeWidth: 4,
  //     // draggable: this.draggable,
  //     type: ShapeType.RECTANGLE,
  //     selectShape: this.selectShape.bind(this),
  //     unselectShape: this.unselectShape.bind(this),
  //   });

  //   return rect;
  // }

  selectShape() {
    //console.log('asd ' + shape);

    //if (shape instanceof Konva.Shape) {
      //shape.stroke('yellow');
      console.log("Select " + JSON.stringify(this));
      
      this.stroke('yellow');
      //this.konvaShape.isSelected = true;
      this.isSelected = true;
    //}
  }

  unselectShape() {
    //if (shape instanceof Konva.Shape) {
      //shape.stroke('black');
      this.stroke('black');
      this.isSelected = false;
    //}
  }
}
