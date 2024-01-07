/*
 * <<licensetext>>
 */
import Konva from "konva";
import { Colors } from "src/app/_constants/colors";
import {ShapeType} from "src/app/_models/shape-type";
export class Breakpoint {
    stage: Konva.Stage;
    x: number;
    y: number;
    draggable: boolean;
    index: number;
    lineId: string;

    constructor(stage: Konva.Stage, x: number, y: number, draggable = false, lineId: string, index: number) {
        this.stage = stage;
        this.x = x;
        this.y = y;
        this.draggable = draggable;
        this.lineId = lineId;
        this.index = index;
    }

    draw(layer: Konva.Layer) {
        layer.add(this.shape());
    }

    shape() {
        const shape = new Konva.Circle({
            x: this.x,
            y: this.y,
            radius: 5,
            stroke: 'black',
            strokeWidth: 3,
            draggable: this.draggable,
            type: ShapeType.BREAKPOINT,
            lineId: this.lineId,
            index: this.index,
        })
        return shape;
    }

}