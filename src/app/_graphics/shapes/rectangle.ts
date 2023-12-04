/*
 * <<licensetext>>
 */
import Konva from "konva";
import { Colors } from "src/app/_constants/colors";
import { Selectable } from "src/app/_interfaces/selectable";
import {ShapeType} from "src/app/_models/shape-type";
export class RectangleShape implements Selectable {
    stage: Konva.Stage;
    x: number;
    y: number;
    width: number;
    height: number;
    draggable: boolean;
    id?: number;
    groupId: string = "";
    konvaShape: Konva.Rect;

    constructor(stage: Konva.Stage, x: number, y: number, width: number, height: number, draggable = false) {
        this.stage = stage;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.draggable = draggable; 

        this.konvaShape = this.shape();
    }

    draw(layer: Konva.Layer) {
        layer.add(this.konvaShape);
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
            selectShape : this.selectShape,
            unselectShape: this.unselectShape
        })

        return rect;
    }

    selectShape() {

        console.log("asd");
        

        if ( this.konvaShape instanceof Konva.Shape){
            this.konvaShape.attrs.stroke("yellow");
            this.konvaShape.attrs.isSelected = true;
        }
    }

    unselectShape() {
        if ( this.konvaShape instanceof Konva.Shape){
            this.konvaShape.attrs.stroke("black");
            this.konvaShape.attrs.isSelected = false;
        }
    }
}