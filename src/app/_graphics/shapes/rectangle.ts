/*
 * <<licensetext>>
 */
import Konva from "konva";
import { Colors } from "src/app/_constants/colors";
import {ShapeType} from "src/app/_models/shape-type";
export class RectangleShape {
    stage: Konva.Stage;
    x: number;
    y: number;
    width: number;
    height: number;
    draggable: boolean;
    isSelected: boolean;
    konvaRect: Konva.Rect;

    constructor(stage: Konva.Stage, x: number, y: number, width: number, height: number, draggable = false) {
        this.stage = stage;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.draggable = draggable;
        this.isSelected = false;

        this.konvaRect = this.shape();
    }

    draw(layer: Konva.Layer) {
        //layer.add(this.shape());
        layer.add(this.konvaRect);
    }

    shape() {
        const rect = new Konva.Rect({
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            fill: Colors.defaultBg,
            stroke: 'black',
            strokeWidth: 4,
            draggable: this.draggable,
            type: ShapeType.RECTANGLE,
          });
      
          // Now you can add event handling to the Konva.Rect
          rect.on('tap', (event) => {
            const shape = event.target;
            console.log(shape);
            
            console.log('Click event on shape!', event);
            this.isSelected = !this.isSelected;
            
            if (shape instanceof Konva.Shape) {
                // Ensure that 'shape' is of type 'Shape'
                shape.fill(this.isSelected ? 'yellow' : 'green');
              }

          });
      
          return rect;
    }
}