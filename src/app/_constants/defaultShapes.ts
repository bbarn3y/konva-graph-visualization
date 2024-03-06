/*
 * <<licensetext>>
 */
import Konva from 'konva';
export class defaultShapes {
  public static gridLine = new Konva.Line({
    points: [],
    stroke: '#ddd',
    strokeWidth: 4,
    listening: false,
  });

  public static connectionLine = new Konva.Line({
    points: [],
    stroke: 'black',
    strokeWidth: 3,
    listening: false,
  });
}
