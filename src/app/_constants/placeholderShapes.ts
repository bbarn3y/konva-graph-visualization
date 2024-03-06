/*
 * <<licensetext>>
 */
import Konva from 'konva';
export class PlaceholderShapes {
  public static placeHolderArrow = new Konva.Arrow({
    points: [],
    stroke: 'black',
    strokeWidth: 3,
    fill: 'black',
    opacity: 0.7,
    width: 5,
    draggable: true,
    listening: false,
  });

  public static placeHolderConnectionCircle = new Konva.Circle({
    x: 0,
    y: 0,
    stroke: 'blue',
    radius: 5,
    strokeWidth: 3,
    opacity: 0,
    listening: false,
  });
}
