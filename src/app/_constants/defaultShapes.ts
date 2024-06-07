/*
 * <<licensetext>>
 */
import Konva from 'konva';
import { ShapeType } from '../_models/shape-type';
export class DefaultShapes {
  public static gridLine = new Konva.Line({
    points: [],
    stroke: '#ddd',
    strokeWidth: 4,
    listening: false,
  });

  public static lineAnchor = new Konva.Circle({
      x: 0,
      y: 0,
      radius: 5,
      stroke: 'black',
      strokeWidth: 3,
      hitStrokeWidth: 10,
      draggable: true,
      type: ShapeType.BREAKPOINT,
      connectionId: ''
    });
}
