/*
 * <<licensetext>>
 */
import Konva from "konva";
import { Colors } from "src/app/_constants/colors";
import {ShapeType} from "src/app/_models/shape-type";
import Selectable from "src/app/_interfaces/selectable";

export class RectangleShape implements Selectable{
    stage: Konva.Stage;
    x: number;
    y: number;
    width: number;
    height: number;
    draggable: boolean;
    id?: number;

    constructor(stage: Konva.Stage, x: number, y: number, width: number, height: number, draggable = false) {
        this.stage = stage;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.draggable = draggable; 
    }

    draw(layer: Konva.Layer) {
        layer.add(this.shape());
    }

    shape() {
        return new Konva.Rect({
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            fill: Colors.defaultBg,
            stroke: 'black',
            strokeWidth: 4,
            draggable: this.draggable,
            type: ShapeType.RECTANGLE
        })
    }

    selectShape(): void {
        if (this instanceof Konva.Shape){
            this.attrs.isSelected = true;
            this.attrs.stroke("yellow");
        }
    }

    unselectShape(): void {
        if (this instanceof Konva.Shape){
            this.attrs.isSelected = false;
            this.stroke("black");
        }
    }
}