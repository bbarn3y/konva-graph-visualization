/*
 * <<licensetext>>
 */

import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
} from '@angular/core';
import Konva from 'konva';
import { ZoomManager } from 'src/app/_services/zoomManager';
import Shape = Konva.Shape;
import Group = Konva.Group;
import { ShapeType } from 'src/app/_models/shape-type';
import { RectangleShape } from 'src/app/_graphics/shapes/rectangle';
import { PathSegment, Vector2d } from 'konva/lib/types';
import {
  BestPoint,
  FinalLineGuide,
  GuideOrientation,
  LineGuide,
  LineGuideStops,
  ObjectBound,
  ObjectSnappingEdges,
  SnapDirection,
} from 'src/app/_interfaces/shapeTypes';
import { PlaceholderShapes } from 'src/app/_constants/placeholderShapes';
import { DefaultShapes } from 'src/app/_constants/defaultShapes';
import { Selectable } from 'src/app/_interfaces/selectable';
import { GroupRectangleShape } from 'src/app/_graphics/shapes/groupRectangle';
import { ConnectionData, isConnectable } from 'src/app/_interfaces/connectable';

@Component({
  selector: 'app-graph-editor',
  templateUrl: './graph-editor.component.html',
  styleUrls: ['./graph-editor.component.less'],
})
export class GraphEditorComponent implements AfterViewInit {
  [x: string]: any;
  @ViewChild('container') containerElement?: ElementRef<HTMLDivElement>;
  @ViewChild('contextMenu') contextMenuElement?: ElementRef<HTMLDivElement>;
  stage!: Konva.Stage;
  selectedLayer?: Konva.Layer;
  selectedShape?: ShapeType;
  static IdCount = 1;
  selectRectangle?: Konva.Rect;
  groups: Konva.Group[] = [];
  placeHolderShape?: Konva.Shape | Konva.Group;
  clickedShape?: Konva.Shape;
  gridLayer?: Konva.Layer;
  zoomLayers: { [key: number]: Konva.Layer } = {};
  placeholderLayerLower?: Konva.Layer;
  placeholderLayerUpper?: Konva.Layer;
  //Configuration
  fieldSize: number = 100;
  windowWidth: number = 300;
  windowHeight: number = 300;
  scaleBy: number = 1.04;
  zoomLevel: number = 1;
  zoomManager!: ZoomManager;
  //Guide line related
  GUIDELINE_OFFSET: number = 5;

  isGrouped: boolean = false;
  isShowContextMenu: boolean = false;
  onlySameGroupElements: boolean = false;
  clamp = (num: number, min: number, max: number) =>
    Math.min(Math.max(num, min), max);
  clampPos = (pos: Vector2d, min: number, max: number) => {
    return {
      x: Math.min(Math.max(pos.x, min), max),
      y: Math.min(Math.max(pos.y, min), max),
    };
  };
  distancePos = (fromPos: Vector2d, targetPos: Vector2d) => {
    const dx = fromPos.x - targetPos.x;
    const dy = fromPos.y - targetPos.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  snapDistance: number = 20;

  //Arrow related
  connectionLayer?: Konva.Layer;
  connectionAnchorLayer?: Konva.Layer;
  placeholderArrow = PlaceholderShapes.placeHolderArrow;
  placeholderConnection = PlaceholderShapes.placeHolderConnectionCircle;
  isDrawingLine: boolean = false;
  tempConnectionData?: ConnectionData;
  placeholderAnchor: Konva.Circle = DefaultShapes.lineAnchor.clone();
  bestPoint?: BestPoint;
  hoveredPathSegment?: PathSegment;
  public selectedLayerNumber: number | null = null;
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.updateViewport();
    this.rePositionStage();
  }

  ShapeType = ShapeType;
  ngAfterViewInit(): void {
    this.initState(() => {
      this.addEventListeners();
  
    });
  }

  initState(callback: () => any) {
    setTimeout(() => {
      this.updateViewport();
  
      // Initialize the Konva stage
      this.stage = new Konva.Stage({
        container: 'container', 
        width: this.windowWidth,
        height: this.windowHeight, 
        draggable: false, 
      });
  
      if (this.stage) {
        // Initialize the ZoomManager with the stage and scroll events per transition
        this.zoomManager = new ZoomManager(this.stage, 5);
  
        // Add a wheel event listener to handle zooming and update the zoom group
        this.stage.on('wheel', (event) => {
          this.zoomManager.handleWheelEvent(event.evt);
          this.updateZoomGroup();
        });
  
        // Initialize the grid layer (once)
        this.gridLayer = new Konva.Layer();
        this.stage.add(this.gridLayer);
  
        // Initialize the connection layer (once)
        this.connectionLayer = new Konva.Layer();
        this.stage.add(this.connectionLayer);
  
        // Set the initial selected layer
        this.selectedLayer = this.zoomManager.zoomLayers[1]; // Default to the second layer
  
        // Initialize and render the grid
        this.updateGrid();
  
        // Debugging logs
        console.log("Zoom Level: ", this.zoomManager.zoomLevel);
        console.log("Scale: ", this.stage.scale());
        console.log("Number of scrolls: ", this.zoomManager.currentScrollEvents);
  
        // Execute the provided callback
        callback();
      }
    }, 0);
  }
  

  addEventListeners() {
    this.stage.on('click', (event) => {
      event.evt.preventDefault();
      this.isShowContextMenu = false;
      if (event.evt.button == 2) {
        this.cancelDrawLine();
        return;
      }
      const pointerPosition = this.stage?.getRelativePointerPosition();
      if (!pointerPosition) return;
      const clickTarget = event.target;

      const snapPos = this.calculateGridSnapPosition(pointerPosition);

      //Draw arrow to shape
      if (
        (this.isDrawingLine && clickTarget instanceof Konva.Shape) ||
        clickTarget instanceof Konva.Group
      ) {
        const actPos = this.calculateConnectionPosition(
          pointerPosition,
          clickTarget
        );
        if (this.tempConnectionData === undefined) return;
        if (isConnectable(clickTarget)) {
          this.tempConnectionData.endShapeId = clickTarget.id();
          clickTarget.addConnection(this.tempConnectionData);
        }
        this.cancelDrawLine();
      } else if (this.isDrawingLine) {
        if (this.tempConnectionData === undefined) return;
        const actPos = this.snapToAngleHelper(
          {
            x: this.tempConnectionData.points[
              this.tempConnectionData.points.length - 2
            ],
            y: this.tempConnectionData.points[
              this.tempConnectionData.points.length - 1
            ],
          },
          pointerPosition
        ); 
        if (this.tempConnectionData !== undefined && actPos) {
          this.tempConnectionData.points.push(...[actPos.x, actPos.y]);
        }
      } else if (
        !this.isDrawingLine &&
        !this.selectedShape &&
        clickTarget instanceof Konva.Arrow
      ) {
        const actPoints = (clickTarget as Konva.Line).points();
        if (this.placeholderAnchor) {
          this.insertBreakpoint(
            actPoints,
            this.placeholderAnchor.x(),
            this.placeholderAnchor.y()
          );
          clickTarget.points(actPoints);
          this.updateConnections();
        }
      } else if (this.selectedShape) {
        this.drawShape(this.selectedShape, snapPos.x, snapPos.y, true);
      }

      // Handling shape selection and unselection
      if (clickTarget === this.stage) {
        const selectedShapes = this.stage
          ?.find('Shape')
          .filter((x) => this.isSelectable(x) && x.isSelected);

        if (!selectedShapes) return;

        selectedShapes.forEach((actShape) => {
          if (this.isSelectable(actShape)) {
            actShape.unselectShape();
          }
        });
      } else if (
        this.isSelectable(clickTarget) &&
        event.evt.button !== 2 &&
        !this.selectedShape
      ) {
        if (event.evt.ctrlKey) {
          if (clickTarget.isSelected) {
            clickTarget.unselectShape();
          } else {
            clickTarget.selectShape();
          }
        } else if (this.isSelectable(clickTarget)) {
          const selectedShapes = this.stage
            ?.find('Shape')
            .filter((x) => this.isSelectable(x) && x.isSelected);

          if (!selectedShapes) return;

          selectedShapes.forEach((actShape) => {
            if (this.isSelectable(actShape)) {
              actShape.unselectShape();
            }
          });
        }

        // Handling group selection and unselection
        if (clickTarget.group !== undefined) {
          if (clickTarget.isSelected) {
            const sameGroupShapes = this.stage
              ?.find('Shape')
              .filter(
                (x) => this.isSelectable(x) && x.group === clickTarget.group
              );

            if (!sameGroupShapes) return;

            sameGroupShapes.forEach((actShape) => {
              if (this.isSelectable(actShape) && actShape.group !== undefined) {
                actShape.selectShape();
              }
            });
          } else {
            const sameGroupShapes = this.stage
              ?.find('Shape')
              .filter(
                (x) => this.isSelectable(x) && x.group === clickTarget.group
              );

            if (!sameGroupShapes) return;

            sameGroupShapes.forEach((actShape) => {
              if (this.isSelectable(actShape) && actShape.group !== undefined) {
                actShape.selectShape();
              }
            });
          }
        }
      }

      const contextMenu = document.getElementById('contextMenu');

      if (!contextMenu) return;

      this.isShowContextMenu = false;
    });
    //@TODO: Should we need to move on stage? If yes we should move by holding middle mouse button
    // Handling stage dragging
    this.stage.on('dragmove', (e) => {
      const scaleX = this.stage.scaleX();
      const scaleY = this.stage.scaleY();

      // Adjust the drag position based on the current scale values
      const absPos = e.target.getAbsolutePosition();
      absPos.x /= scaleX;
      absPos.y /= scaleY;

      e.target.absolutePosition(absPos);

      // Update the viewport position after dragging
      this.rePositionStage();
    });

    this.stage.on('dragend', (e) => {
      const scaleX = this.stage.scaleX();
      const scaleY = this.stage.scaleY();

      // Adjust the final drag position based on the current scale values
      const absPos = e.target.getAbsolutePosition();
      absPos.x /= scaleX;
      absPos.y /= scaleY;

      e.target.absolutePosition(absPos);

      // Reposition the viewport to match the new stage position
      this.rePositionStage();
    });


    this.stage.on('contextmenu', (e) => {
      e.evt.preventDefault();
      this.isShowContextMenu = false;

      if (this.isDrawingLine) {
        this.cancelDrawLine();
        return;
      }

      // Check if we are on an empty place of the stage
      if (e.target === this.stage || this.selectedShape) {
        return;
      }

      if (!this.contextMenuElement) return;

      if (e.target instanceof Konva.Shape) {
        this.clickedShape = e.target;
      }

      if (this.isSelectable(e.target))
        if (e.target.group !== undefined && e.target.isSelected) {
          //Check if target is grouped or not
          this.isGrouped = true;
        } else {
          this.isGrouped = false;
        }

      //Check if all the selected shapes are in the same group
      const selectedShapes = this.stage
        ?.find('Shape')
        .filter((x) => this.isSelectable(x) && x.isSelected);
      this.onlySameGroupElements =
        selectedShapes.every(
          (shape) =>
            this.isSelectable(shape) &&
            this.isSelectable(selectedShapes[0]) &&
            shape.group === selectedShapes[0].group &&
            shape.group !== undefined
        ) || selectedShapes.length < 2;

      // Show context menu
      this.isShowContextMenu = true;

      // Set position based on the mouse pointer
      this.contextMenuElement.nativeElement.style.top = e.evt.clientY + 'px';
      this.contextMenuElement.nativeElement.style.left = e.evt.clientX + 'px';
    });

    this.stage.on('mousedown', (event) => {
      // Store the starting point when the left mouse button is pressed
      if (
        event.evt.button === 0 &&
        event.evt.shiftKey &&
        this.selectedShape === undefined &&
        !event.evt.ctrlKey
      ) {
        const pointerPosition = this.stage.getRelativePointerPosition();
        if (pointerPosition) {
          this.selectRectangle = new Konva.Rect({
            x: pointerPosition.x,
            y: pointerPosition.y,
            width: 0,
            height: 0,
            stroke: 'blue',
            strokeWidth: 2,
          });

          this.selectedLayer?.add(this.selectRectangle);
          this.selectedLayer?.batchDraw();
        }
      }
    });

    this.stage.on('mousemove', (e) => {
      e.evt.preventDefault();
      // Update the position and dimensions of the temporary rectangle while dragging
      /* Old multi selection, commented out beaces of dragmove of the stage, on merge
      should change to new multi selection. */
      if (this.selectRectangle !== undefined) {
        const currentMousePos = this.stage.getRelativePointerPosition();
        if (currentMousePos) {
          const width = currentMousePos.x - this.selectRectangle.x();
          const height = currentMousePos.y - this.selectRectangle.y();

          this.selectRectangle.width(width);
          this.selectRectangle.height(height);

          this.selectedLayer?.batchDraw();
        }
        return;
      }

      if (this.isDrawingLine) {
        // If we are currently drawing a line, hide the placeholder anchor and reset the best point.
        this.placeholderAnchor.opacity(0.0);
        this.bestPoint = undefined;
        this.updatePlaceholderArrow();
        return;
      } else {
        // Get the current pointer position relative to the stage.
        const pointerPos = this.stage.getRelativePointerPosition();
        if (!pointerPos) return;
        if (!this.connectionLayer) return;
        if (
          this.connectionLayer.children &&
          this.connectionLayer.children.length === 0
        )
          return;

        // Extract all points from the arrows in the connection layer.
        const actAllPoints: number[] = this.connectionLayer.children
          .filter((child) => 'points' in child.attrs)
          .flatMap((arrow) => arrow.attrs.points as number[]);

        // If there are no points, exit the function.
        if (!actAllPoints || actAllPoints.length === 0) return;

        // Create a clone of the placeholder arrow and set its points.
        const actArrow: Konva.Arrow = this.placeholderArrow.clone();
        actArrow.points(actAllPoints);

        // Reset the best point.
        this.bestPoint = undefined;

        // Find the closest point on the transformed path to the current pointer position.
        const actBestPoint = this.getClosestPoint(
          this.transformArrowToPath(actArrow),
          pointerPos
        );

        // If a best point is found and the distance is less than 25, update the best point.
        if (actBestPoint && actBestPoint.distance < 25) {
          this.bestPoint = actBestPoint;
        }

        // If there is a best point, show the placeholder anchor at this position.
        if (this.bestPoint) {
          this.placeholderAnchor.opacity(1.0);
          this.placeholderAnchor.position({
            x: this.bestPoint.x,
            y: this.bestPoint.y,
          });
        } else {
          // Otherwise, hide the placeholder anchor and reset the best point.
          this.placeholderAnchor.opacity(0.0);
          this.bestPoint = undefined;
        }
      }

      this.stage.on('mouseup', (event) => {
        // Clear the selection rectangle when the left mouse button is released
        if (
          event.evt.button === 0 &&
          !this.selectedShape &&
          this.selectRectangle
        ) {
          this.removeSelectionOnShapes();
          const selectedShapes = this.getAllShapesInSelection();

          selectedShapes.forEach((actShape) => {
            if (this.isSelectable(actShape)) {
              actShape.selectShape();
            }
          });
          this.selectRectangle.destroy();
          this.selectRectangle = undefined;
          this.selectedLayer?.batchDraw();
        }
      });
    });
  }

  selectShape(shape: ShapeType | undefined) {
    if (this.isDrawingLine) return;
    this.selectedShape = shape;
  }

  drawShape(
    shapeType: ShapeType,
    x: number,
    y: number,
    draggable: boolean = false,
    count: number = 0,
    subShapes: Konva.Shape[] = []
  ) {
    const shapeSize = this.calculateShapeSize();

    if (this.stage && this.selectedLayer) {
      let shape;
      switch (shapeType) {
        case ShapeType.RECTANGLE:
          shape = new RectangleShape(
            this.stage,
            x,
            y,
            shapeSize.x,
            shapeSize.y,
            draggable,
            this.zoomLevel
          );

          shape.on('dragstart', (e) => {
            this.placeholderConnection.opacity(0);
            e.currentTarget.moveToTop();
          });
          shape.on('dragend', (e) => {
            const snapPos = this.calculateGridSnapPosition(
              e.currentTarget.getPosition()
            );
            e.currentTarget.position(snapPos);
            this.updateConnections();
          });
          shape.on('dragmove', (e) => {
            this.placeholderAnchor.opacity(0.0);
            const snapPos = this.calculateGridSnapPosition(
              e.currentTarget.getPosition()
            );
            e.currentTarget.position(snapPos);
            this.updateConnections();
          });
          shape.on('dblclick', (e) => {
            if (
              e.currentTarget instanceof Konva.Shape ||
              e.currentTarget instanceof Konva.Group
            ) {
              //Drawing line is only available on lowest zoom level (1-2)
              if (this.zoomLevel > 2) return;
              const pointerPos = this.stage.getPointerPosition();
              if (!pointerPos) return;
              this.isDrawingLine = true;
              const connectionPos = this.calculateConnectionPosition(
                this.stage.getRelativePointerPosition()!,
                e.currentTarget
              );
              const snapPos = this.snapToAngleHelper(connectionPos, pointerPos);
              this.tempConnectionData = {
                connectionId: this.getUniqueId(4),
                startShapeId: e.currentTarget.id(),
                endShapeId: '',
                points: [],
                arrowShape: this.placeholderArrow,
              };
              this.placeholderArrow.attrs.connectionId =
                this.tempConnectionData.connectionId;
              this.connectionLayer?.add(this.placeholderArrow);
              if (this.tempConnectionData !== undefined) {
                this.tempConnectionData.points = [
                  connectionPos.x,
                  connectionPos.y,
                  snapPos.x,
                  snapPos.y,
                ];
              }
            }
          });

          shape.on('mousemove', (e) => {
            if (
              e.currentTarget instanceof Konva.Shape ||
              e.currentTarget instanceof Konva.Group
            ) {
              const pointerPos = this.stage.getRelativePointerPosition();
              if (!pointerPos) return;

              //Placeholder connection shape
              const fromPos =
                this.tempConnectionData &&
                this.tempConnectionData.points.length >= 4
                  ? this.calculateConnectionPosition(
                      {
                        x: this.tempConnectionData.points[
                          this.tempConnectionData.points.length - 4
                        ],
                        y: this.tempConnectionData.points[
                          this.tempConnectionData.points.length - 3
                        ],
                      },
                      e.currentTarget
                    )
                  : this.calculateConnectionPosition(
                      pointerPos,
                      e.currentTarget
                    );
              this.placeholderConnection.position(fromPos);
              this.placeholderConnection.opacity(0.65);
            }
          });

          shape.on('mouseout', (e) => {
            this.placeholderConnection.opacity(0);
          });
          break;

        case ShapeType.GROUPRECTANGLE:
          shape = new GroupRectangleShape(
            this.stage,
            x,
            y,
            shapeSize.x,
            shapeSize.y,
            draggable,
            count,
            subShapes
          );
          break;

        default:
          break;
      }

      if (!shape) {
        return;
      }

      shape.attrs.id = GraphEditorComponent.IdCount++;

      // Add shapes to the appropriate zoom layer (selectedLayer)
      this.selectedLayer.add(shape); // Add shape to selected layer
      shape.drawShape(this.selectedLayer, shapeSize.y, shapeSize.x);

      this.selectedLayer.draw(); // Redraw the selected layer

      return shape;
    } else {
      return;
    }
  }

  //Calculate the topleft position of given grid with a padding
  calculateGridSnapPosition(vector: Vector2d): Vector2d {
    const padding = 10;
    const shapeSize = this.calculateShapeSize();
    const weightedFieldSize = this.fieldSize * this.zoomLevel;
    const pos = {
      x: Math.round(vector.x / weightedFieldSize) * weightedFieldSize + padding,
      y:
        Math.round(vector.y / weightedFieldSize) * weightedFieldSize +
        (weightedFieldSize + shapeSize.y) -
        weightedFieldSize -
        padding,
    };
    return pos;
  }

  //Adjust the shapeSize to fit in a grid (Rectangle based)
  calculateShapeSize(): Vector2d {
    const size = Math.round(this.fieldSize / 4);
    return {
      x: size,
      y: size,
    };
  }
  updateViewport() {
    const topPadding = 70;
    const horizontalPadding = 20;
    this.windowWidth = window.innerWidth - horizontalPadding;
    this.windowHeight = window.innerHeight - topPadding;
    if (!this.stage) return;
    this.stage.width(this.windowWidth);
    this.stage.height(this.windowHeight);
  }

  updateGrid() {
    if (!this.gridLayer) return;
    if (this.gridLayer.children.length > 0) {
      //Remove all previous lines
      this.gridLayer.removeChildren();
    }
    const weightedFieldSize = this.fieldSize * Math.max(this.zoomLevel, 1);
    const stageWidth = 2000 * Math.max(this.zoomLevel, 1);
    const stageHeight = 2000 * Math.max(this.zoomLevel, 1);
    //Starting and last x axis coord for loop
    //Draw lines based of the current stage position, the stage width (viewport) and the gridSize based on zoomLevel
    const startX =
      Math.floor((-this.stage.x() - stageWidth) / weightedFieldSize) *
      weightedFieldSize;
    const endX =
      Math.floor((-this.stage.x() + stageWidth) / weightedFieldSize) *
      weightedFieldSize *
      this.zoomLevel;

    //Starting and last y axis coord for loop
    const startY =
      Math.floor((-this.stage.y() - stageHeight) / weightedFieldSize) *
      weightedFieldSize;
    const endY =
      Math.floor((-this.stage.y() + stageHeight) / weightedFieldSize) *
      weightedFieldSize *
      this.zoomLevel;
    //In every loop we draw a line in every direction
    //then increasing the current x pos by gridSize
    const gridLine = DefaultShapes.gridLine;
    for (let x = startX; x < endX; x += weightedFieldSize) {
      this.gridLayer.add(gridLine.clone().points([x, 0, startY - endY]));
      this.gridLayer.add(gridLine.clone().points([-x, 0, -x, endY - startY]));
      this.gridLayer.add(gridLine.clone().points([x, 0, x, endY - startY]));
      this.gridLayer.add(gridLine.clone().points([-x, 0, -x, startY - endY]));
      this.gridLayer.batchDraw();
    }
    //We do same on the Y axis
    for (let y = startY; y < endY; y += weightedFieldSize) {
      this.gridLayer.add(gridLine.clone().points([0, y, startX - endX, y]));
      this.gridLayer.add(gridLine.clone().points([0, y, endX - startX, y]));
      this.gridLayer.add(gridLine.clone().points([0, -y, endX - startX, -y]));
      this.gridLayer.add(gridLine.clone().points([0, -y, startY - endY, -y]));
      this.gridLayer.batchDraw();
    }
  }
  updateZoomGroup() {
    if (!this.gridLayer || !this.selectedLayer) return;
  
    // Remove old grouped elements
    const groupShapes = this.stage.find('Shape').filter((x) => x instanceof GroupRectangleShape);
    groupShapes.forEach((shape) => shape.destroy());
  
    const totalZoomLevels = this.zoomManager.zoomLayers.length;
    const zoomLevel = this.zoomManager.zoomLevel;
  
    const firstThird = Math.ceil(totalZoomLevels / 3);
    const secondThird = Math.ceil((2 * totalZoomLevels) / 3);
  
    let weightedFieldSize = this.fieldSize * Math.max(this.zoomLevel, 1);
  
    // Adjust field size based on the current zoom level
    if (zoomLevel > firstThird && zoomLevel <= secondThird) {
      weightedFieldSize *= 2;
    } else if (zoomLevel > secondThird) {
      weightedFieldSize *= 4;
    }
  
    const stageWidth = 2000 * Math.max(this.zoomLevel, 1);
    const stageHeight = 2000 * Math.max(this.zoomLevel, 1);
  
    // Calculate the grid boundaries
    const startX = Math.floor((-this.stage.x() - stageWidth) / weightedFieldSize) * weightedFieldSize;
    const endX = Math.floor((-this.stage.x() + stageWidth) / weightedFieldSize) * weightedFieldSize;
    const startY = Math.floor((-this.stage.y() - stageHeight) / weightedFieldSize) * weightedFieldSize;
    const endY = Math.floor((-this.stage.y() + stageHeight) / weightedFieldSize) * weightedFieldSize;
  
    // Initialize grid for grouping shapes
    const gridCounts = Array.from(
      { length: Math.floor((endX - startX) / weightedFieldSize) },
      () => Array.from({ length: Math.floor((endY - startY) / weightedFieldSize) }, () => [] as Konva.Shape[]),
    );
  
    const shapes = this.stage.find('Shape').filter((x) => this.isSelectable(x));
    shapes.forEach((shape) => {
      const gridX = Math.floor((shape.x() - startX) / weightedFieldSize);
      const gridY = Math.floor((shape.y() - startY) / weightedFieldSize);
      if (
        gridX >= 0 &&
        gridX < gridCounts.length &&
        gridY >= 0 &&
        gridY < gridCounts[0].length
      ) {
        if (shape instanceof Konva.Shape) {
          gridCounts[gridX][gridY].push(shape); // Group shapes into grid cells
        }
      }
    });
  
    // Render grouped elements
    gridCounts.forEach((row, i) => {
      row.forEach((cell, j) => {
        if (cell.length > 0) {
          const pos = { x: startX + i * weightedFieldSize, y: startY + j * weightedFieldSize };
  
          if (zoomLevel > firstThird) {
            this.drawShape(ShapeType.GROUPRECTANGLE, pos.x, pos.y, true, cell.length);
  
            // Gradually fade out previous level's details and fade in the grouped shape
            cell.forEach((shape) => {
              let opacity = 1;
  
              // Fading out previous zoom level before switching to the new one
              if (zoomLevel === totalZoomLevels) {
                opacity = 0.1; // Details almost completely disappear at the last zoom level
              } else if (zoomLevel > secondThird) {
                opacity = 0; // Detailed view completely disappears at the second zoom level
              } else if (zoomLevel > firstThird && zoomLevel <= secondThird) {
                opacity = Math.max(1, 1 - (zoomLevel - firstThird) / totalZoomLevels);
              }
  
              shape.to({
                opacity: opacity,
                duration: 0.5,
                easing: Konva.Easings.EaseOut,
              });
            });
          } else {
            cell.forEach((shape) => {
              shape.to({
                opacity: 1,
                duration: 0.5,
                easing: Konva.Easings.EaseIn,
              });
            });
          }
        }
      });
    });
  }
  
  // Reposition the stage, ensuring the coordinates are clamped based on the zoom level
  rePositionStage(pos?: Vector2d) {
    if (!pos) pos = this.stage.position();
  
    const rangeFactor = Math.max(this.zoomLevel, 1);
    const rangeX: number = this.stage.width() * rangeFactor;
    const rangeY: number = this.stage.height() * rangeFactor;
  
    const clampedX = this.clamp(pos.x, -Math.floor(rangeX), Math.floor(rangeX));
    const clampedY = this.clamp(pos.y, -Math.floor(rangeY), Math.floor(rangeY));
  
    this.stage.setPosition({ x: clampedX, y: clampedY });
  }
  
  
  
  

  //
  //Drag events from toolbar
  //
  shapeMenuItemDragStarted(shapeType: ShapeType, e?: Event) {
    if (this.isDrawingLine) return;
    this.selectedShape = shapeType;
  }

  //Dropped on a Konva stage
  onDrop(e: Event) {
    e.preventDefault();
    if (!this.stage || !this.selectedShape) {
      return;
    }
    this.stage.setPointersPositions(e);
    if (!this.stage.pointerPos) return;
    const pointerPos = this.stage.getRelativePointerPosition();
    if (!pointerPos) return;
    const snapPos = this.calculateGridSnapPosition(pointerPos);
    if (this.stage.pointerPos) {
      this.drawShape(this.selectedShape, snapPos.x, snapPos.y, true);
      this.placeHolderShape?.remove();
      this.placeHolderShape = undefined;
    }
  }

  //Drag a shape from toolbar and the pointer is over a Konva stage.
  onDragOver(e: Event) {
    e.preventDefault();
    this.stage.setPointersPositions(e);
    if (!this.selectedShape) return;
    if (!this.stage.pointerPos) return;
    const pointerPos = this.stage.getRelativePointerPosition();
    if (!pointerPos) return;
    const snapPos = this.calculateGridSnapPosition(pointerPos);
    //Draw placeholderShape
    if (!this.placeHolderShape) {
      this.placeHolderShape = this.drawShape(
        this.selectedShape,
        snapPos.x,
        snapPos.y,
        true
      );
      this.placeHolderShape?.opacity(0.5);
    }
    //Reposition the placeHolderShape
    if (this.placeHolderShape) {
      this.placeHolderShape.position(snapPos);
    }
  }

  //A dragged shape leaves the konva stage.
  onDragLeave(e: Event) {
    e.preventDefault();
    if (!this.placeHolderShape) return;
    //Remove placeholder shape;
    this.placeHolderShape.remove();
    this.placeHolderShape = undefined;
  }

  onDragEnd(e: Event) {
    e.preventDefault();
  }

  //A selected shape will be unselected
  removeSelectionOnShapes() {
    const allShapes = this.stage?.find('Shape');

    if (!allShapes) return;

    allShapes.forEach((actShape) => {
      if (this.isSelectable(actShape) && actShape.isSelected) {
        actShape.unselectShape();
      }
    });
  }

  //Gets all shapes that are in the select area
  getAllShapesInSelection(): Konva.Shape[] {
    const selectedShapes: Konva.Shape[] = [];
    const selectionRect = this.selectRectangle;

    if (!selectionRect) {
      return selectedShapes;
    }

    const allShapes = this.stage?.find((x: any) => x instanceof RectangleShape);
    if (!allShapes) {
      return selectedShapes;
    }

    allShapes.forEach((shape) => {
      if (shape instanceof Konva.Shape) {
        // Check if the node is a shape
        // Get the bounding box of the shape
        const shapeBoundingBox = shape.getClientRect();

        // Check if all corners of the shape are within the selection rectangle
        const isShapeFullyWithinSelection =
          this.isPointWithinSelection(shapeBoundingBox.x, shapeBoundingBox.y) &&
          this.isPointWithinSelection(
            shapeBoundingBox.x + shapeBoundingBox.width,
            shapeBoundingBox.y
          ) &&
          this.isPointWithinSelection(
            shapeBoundingBox.x + shapeBoundingBox.width,
            shapeBoundingBox.y + shapeBoundingBox.height
          ) &&
          this.isPointWithinSelection(
            shapeBoundingBox.x,
            shapeBoundingBox.y + shapeBoundingBox.height
          );

        if (isShapeFullyWithinSelection) {
          selectedShapes.push(shape);
        }
      }
    });

    return selectedShapes;
  }

  //Check if given point is in select area
  private isPointWithinSelection(x: number, y: number): boolean {
    const selectionRect = this.selectRectangle;

    if (!selectionRect) {
      return false;
    }

    const x1 = Math.min(
      selectionRect.x(),
      selectionRect.x() + selectionRect.width()
    );
    const x2 = Math.max(
      selectionRect.x(),
      selectionRect.x() + selectionRect.width()
    );
    const y1 = Math.min(
      selectionRect.y(),
      selectionRect.y() + selectionRect.height()
    );
    const y2 = Math.max(
      selectionRect.y(),
      selectionRect.y() + selectionRect.height()
    );

    return x >= x1 && x <= x2 && y >= y1 && y <= y2;
  }

  //Creates a unique 4bit format id
  //Given number in the parameter defines how many 4bit parts should the id contain
  //4bit parts separated by '-' character
  private getUniqueId(parts: number): string {
    const stringArr = [];
    for (let i = 0; i < parts; i++) {
      // tslint:disable-next-line:no-bitwise
      const S4 = (((1 + Math.random()) * 0x10000) | 0)
        .toString(16)
        .substring(1);
      stringArr.push(S4);
    }
    return stringArr.join('-');
  }

  //Groups the selected shapes
  //Works on already grouped shapes
  public groupSelectedShapes(): void {
    const group = new Konva.Group();
    group.attrs.id = this.getUniqueId(4);

    const selectedShapes = this.stage
      ?.find('Shape')
      .filter((x) => this.isSelectable(x) && x.isSelected);

    if (!selectedShapes) return;

    // Preprocess shapes that are already in a group
    const isRegroupingNeeded = selectedShapes.some(
      (x) => this.isSelectable(x) && x.group !== undefined
    );

    const groupsToDelete: Konva.Group[] = [];

    selectedShapes.forEach((actShape) => {
      if (
        this.isSelectable(actShape) &&
        actShape.group !== undefined &&
        !groupsToDelete.includes(actShape.group)
      ) {
        groupsToDelete.push(actShape.group);
        actShape.group = undefined;
      }
    });

    // Remove the old groups
    groupsToDelete.forEach((actGroup) => {
      const index = this.groups.indexOf(actGroup);
      if (index !== -1) {
        this.groups.splice(index, 1);
      }
    });

    // Group all the selected shapes
    selectedShapes.forEach((actShape) => {
      if (this.isSelectable(actShape) && actShape instanceof Konva.Shape) {
        actShape.unselectShape();
        actShape.group = group;
        group.add(actShape);
      }
    });

    // Add the group to the appropriate zoom layer
    const targetLayer = this.zoomLayers[this.zoomLevel];
    targetLayer.add(group);
    targetLayer.draw();

    this.groups.push(group);
    this.isShowContextMenu = false;
    this.clickedShape = undefined;
  }

  public ungroupSelectedShapes(): void {
    const selectedShapes = this.stage
      ?.find('Shape')
      .filter((x) => this.isSelectable(x) && x.isSelected);

    if (!selectedShapes || !this.isSelectable(this.clickedShape)) return;

    const groupToDelete = this.clickedShape?.group;

    if (groupToDelete === undefined) return;

    selectedShapes.forEach((actShape) => {
      if (this.isSelectable(actShape)) {
        if (actShape.group === groupToDelete) {
          actShape.group = undefined;
        }
        actShape.unselectShape();
      }
    });

    const index = this.groups.indexOf(groupToDelete);
    if (index !== -1) {
      this.groups.splice(index, 1);
    }

    // Add shapes back to the zoom layer
    selectedShapes.forEach((actShape) => {
      if (actShape instanceof Konva.Shape) {
        const targetLayer = this.zoomLayers[this.zoomLevel];
        targetLayer.add(actShape);
      }
    });

    this.isShowContextMenu = false;
    this.clickedShape = undefined;
  }

  //Deletes the clicked shape
  public deleteShape(): void {
    if (this.clickedShape === undefined) return;

    if (this.clickedShape instanceof GroupRectangleShape) {
      // delete subshapes if there are any
      this.clickedShape.subShapes.forEach((subShape) => {
        const sameGroupShapes = this.stage
          ?.find('Shape')
          .filter((x) => x.attrs.group === subShape?.attrs.group);

        if (sameGroupShapes.length < 3) {
          const groupToDelete = subShape.attrs.group;

          sameGroupShapes.forEach((actShape) => {
            actShape.attrs.group = undefined;
          });

          const index = this.groups.indexOf(groupToDelete);
          if (index !== -1) {
            this.groups.splice(index, 1);
          }
        }
        subShape.destroy();
        this.isShowContextMenu = false;
      });
    }

    // delete clicked shape
    const sameGroupShapes = this.stage
      ?.find('Shape')
      .filter((x) => x.attrs.group === this.clickedShape?.attrs.group);

    if (sameGroupShapes.length < 3) {
      const groupToDelete = this.clickedShape.attrs.group;

      sameGroupShapes.forEach((actShape) => {
        actShape.attrs.group = undefined;
      });

      const index = this.groups.indexOf(groupToDelete);
      if (index !== -1) {
        this.groups.splice(index, 1);
      }
    }

    this.clickedShape.destroy();
    this.isShowContextMenu = false;
    this.clickedShape = undefined;

    const selectedShapes = this.stage
      ?.find('Shape')
      .filter((x) => x.attrs.isSelected);

    if (!selectedShapes) return;

    selectedShapes.forEach((actShape) => {
      if (actShape instanceof Konva.Shape) {
        actShape.stroke('black');
      }
      actShape.attrs.isSelected = false;
    });
  }

  snapToAngle(angle: number, targetAngle: number, threshold: number) {
    const snappedAngle = Math.round(angle / targetAngle) * targetAngle;
    const diff = Math.abs(angle - snappedAngle);
    return diff <= threshold ? snappedAngle : angle;
  }
  updatePlaceholderArrow() {
    if (this.tempConnectionData === undefined) return;
    const pointerPos = this.stage.getRelativePointerPosition();

    if (!pointerPos) return;
    let actPoints: number[] = this.tempConnectionData.points;
    let startPoints: Vector2d = { x: pointerPos.x, y: pointerPos.y };
    if (actPoints.length >= 4) {
      startPoints = {
        x: actPoints[actPoints.length - 4],
        y: actPoints[actPoints.length - 3],
      };
    } else {
      startPoints = {
        x: actPoints[actPoints.length - 2],
        y: actPoints[actPoints.length - 1],
      };
    }

    const snapPos = this.snapToAngleHelper(startPoints, pointerPos);
    actPoints[actPoints.length - 2] = snapPos.x;
    actPoints[actPoints.length - 1] = snapPos.y;
    this.placeholderArrow.points(actPoints);
  }

  cancelDrawLine() {
    this.isDrawingLine = false;
    this.placeholderArrow.remove();
    this.placeholderArrow.attrs.connectionId = '';
    this.tempConnectionData = undefined;
    this.updateConnections();
  }

  updateConnections() {
    if (
      !this.selectedLayer ||
      !this.connectionLayer ||
      !this.connectionAnchorLayer
    )
      return;

    const actConnectableShapes = this.selectedLayer
      .find('Shape')
      .filter((shape) => isConnectable(shape));

    const allConnection = [
      ...new Set(
        actConnectableShapes.map((shape) =>
          isConnectable(shape) ? shape.connections : []
        )
      ),
    ].filter((array) => array.length > 0);

    // Clear the connection layers before redrawing
    this.connectionLayer.children = [];
    this.connectionAnchorLayer.children = [];

    allConnection.forEach((connection) => {
      connection.forEach((connectionData) => {
        const pointerPos = this.stage.getPointerPosition();
        if (!pointerPos) return;

        const actStartShape = actConnectableShapes.find(
          (shape) => shape.id() === connectionData.startShapeId
        );
        const actEndShape = actConnectableShapes.find(
          (shape) => shape.id() === connectionData.endShapeId
        );

        if (!actStartShape || !actEndShape) return;

        // Update connection points for valid connection data
        if (connectionData.points.length >= 4) {
          const startSnapPos = this.calculateConnectionPosition(
            { x: connectionData.points[2], y: connectionData.points[3] },
            actStartShape as Shape
          );
          const endSnapPos = this.calculateConnectionPosition(
            {
              x: connectionData.points[connectionData.points.length - 4],
              y: connectionData.points[connectionData.points.length - 3],
            },
            actEndShape as Shape
          );

          connectionData.points[0] = startSnapPos.x;
          connectionData.points[1] = startSnapPos.y;
          connectionData.points[connectionData.points.length - 2] =
            endSnapPos.x;
          connectionData.points[connectionData.points.length - 1] =
            endSnapPos.y;

          // Draw anchor points for intermediate connection points
          if (connectionData.points.length >= 6) {
            const pairs = connectionData.points.reduce<number[][]>(
              (result, value, index, array) => {
                if (index % 2 === 0) {
                  result.push(array.slice(index, index + 2));
                }
                return result;
              },
              []
            );
            if (pairs.length >= 2) {
              pairs.shift();
              pairs.pop();
              pairs.forEach((pair, index) => {
                const actAnchor: Konva.Circle =
                  DefaultShapes.lineAnchor.clone();
                actAnchor.attrs.connectionId = connectionData.connectionId;
                actAnchor.attrs.x = pair[0];
                actAnchor.attrs.y = pair[1];
                index = (index + 1) * 2;
                actAnchor.on('dragstart', (e) => {
                  this.placeholderAnchor.opacity(0.0);
                });
                actAnchor.on('dragmove', (e) => {
                  const actDragPos = e.currentTarget.getPosition();
                  if (!actDragPos) return;
                  const actPoints = connectionData.arrowShape.points();
                  actPoints[index] = actDragPos.x;
                  actPoints[index + 1] = actDragPos.y;
                  connectionData.arrowShape.points(actPoints);
                  this.connectionLayer?.draw();
                });
                actAnchor.on('dragend', (e) => {
                  this.updateConnections();
                });
                this.connectionAnchorLayer?.add(actAnchor);
              });
            }
          }

          const actArrow: Konva.Arrow =
            PlaceholderShapes.placeHolderArrow.clone();
          actArrow.attrs.points = connectionData.points;
          this.connectionLayer?.add(actArrow);
          this.connectionLayer?.batchDraw();
        }
      });
    });
  }

  pointsToPath(points: number[]) {
    let path = '';
    for (var i = 0; i < points.length; i = i + 2) {
      switch (i) {
        case 0: // move to
          path = path + 'M ' + points[i] + ',' + points[i + 1] + ' ';
          break;
        default:
          path = path + 'L ' + points[i] + ',' + points[i + 1] + ' ';
          break;
      }
    }
    return path;
  }

  transformArrowToPath(arrowShape: Konva.Arrow) {
    // Function to make a Konva path from the points array of a Konva.Line shape.
    // Returns a path that can be given to a Konva.Path as the .data() value.
    // Points array is as [x1, y1, x2, y2, ... xn, yn]
    // Path is a string as "M x1, y1 L x2, y2...L xn, yn"
    const actPath = new Konva.Path({
      stroke: arrowShape.stroke(),
      strokeWidth: arrowShape.strokeWidth(),
      data: this.pointsToPath(arrowShape.points()),
    });
    return actPath;
  }

  getClosestPoint(
    pathNode: Konva.Path,
    point: Vector2d
  ): BestPoint | undefined {
    const pathLength: number = pathNode.getLength(); // Get the total length of the path
    const precision: number = 8; // Define the precision of the linear scan
    let best: Vector2d | undefined;
    let bestLength: number | undefined;
    let bestDistance: number = Infinity;

    // Function to calculate the squared distance between two points
    function distance2(p: Vector2d): number {
      const dx: number = p.x - point.x;
      const dy: number = p.y - point.y;
      return dx * dx + dy * dy;
    }

    // Perform a linear scan along the path with the defined precision
    for (
      let scanLength: number = 0, scanDistance: number;
      scanLength <= pathLength;
      scanLength += precision
    ) {
      // Get the point on the path at the current length
      const scan: Vector2d = pathNode.getPointAtLength(scanLength);

      // Calculate the distance from the scan point to the target point
      scanDistance = distance2(scan);

      // If this distance is the smallest found so far, update the best point
      if (scanDistance < bestDistance) {
        // Map the lengths of the path segments
        const mappedDataLenghts = pathNode.dataArray.map((value, index) => {
          return pathNode.dataArray
            .slice(0, index + 1)
            .reduce((acc, curr) => acc + curr.pathLength, 0);
        });

        // Filter out the segments that have been passed
        const fitleredDataArray = mappedDataLenghts
          .map((data, index) => {
            if (data >= scanLength) return index;
            else return;
          })
          .filter((index) => index !== undefined);

        best = scan;
        bestLength = scanLength;
        bestDistance = scanDistance;

        // Store the hovered path segment for adding inner breakpoints
        this.hoveredPathSegment = pathNode.dataArray[fitleredDataArray[0] ?? 0];
      }
    }

    // Perform a binary search for a more precise estimate
    let currentPrecision: number = precision / 2;
    while (currentPrecision > 0.5) {
      let before: Vector2d | undefined;
      let after: Vector2d | undefined;
      let beforeLength: number | undefined;
      let afterLength: number | undefined;
      let beforeDistance: number | undefined;
      let afterDistance: number | undefined;
      // Map the lengths of the path segments again for the current precision level
      const mappedDataLenghts = pathNode.dataArray.map((value, index) => {
        return pathNode.dataArray
          .slice(0, index + 1)
          .reduce((acc, curr) => acc + curr.pathLength, 0);
      });

      // Skip over certain scan lengths to avoid redundant calculations
      const actSkipScanLength = 10;
      if (
        mappedDataLenghts.some(
          (length) =>
            length - actSkipScanLength <= bestLength! &&
            length + actSkipScanLength >= bestLength!
        )
      )
        return undefined;
      else if (
        // Check if moving backwards along the path improves the result
        (beforeLength = bestLength! - currentPrecision) >= 0 &&
        (beforeDistance = distance2(
          (before = pathNode.getPointAtLength(beforeLength))
        )) < bestDistance
      ) {
        best = before!;
        bestLength = beforeLength;
        bestDistance = beforeDistance;
      } else if (
        // Check if moving forwards along the path improves the result
        (afterLength = bestLength! + currentPrecision) <= pathLength &&
        (afterDistance = distance2(
          (after = pathNode.getPointAtLength(afterLength))
        )) < bestDistance
      ) {
        best = after!;
        bestLength = afterLength;
        bestDistance = afterDistance;
      } else {
        // Reduce the precision for finer adjustments
        currentPrecision /= 2;
      }
    }

    if (!best) {
      throw new Error('Failed to find closest point.');
    }

    // Return the closest point with its coordinates and distance
    const closest: BestPoint = {
      x: best.x,
      y: best.y,
      distance: Math.sqrt(bestDistance),
    };
    return closest;
  }

  snapToAngleHelper(startPos: Vector2d, endPos: Vector2d) {
    // Calculate the difference in x and y coordinates between the start and end positions
    const deltaX = endPos.x - startPos.x;
    const deltaY = endPos.y - startPos.y;

    // Calculate the angle in degrees from the horizontal axis to the line connecting startPos and endPos
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Snap the calculated angle to the nearest multiple of 90 degrees within a tolerance of 5 degrees
    const snappedAngle = this.snapToAngle(angle, 90, 5);

    // Calculate the distance (length) between startPos and endPos
    const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);

    // Calculate the new x and y coordinate after snapping to the angle
    const snappedX =
      startPos.x + length * Math.cos((snappedAngle * Math.PI) / 180);
    const snappedY =
      startPos.y + length * Math.sin((snappedAngle * Math.PI) / 180);

    // Return the new coordinates as a Vector2d object
    return { x: snappedX, y: snappedY } as Vector2d;
  }

  //Guide line related
  getLineGuideStops(skipShape?: any) {
    if (!this.stage) return;
    // we can snap to stage borders and the center of the stage
    const vertical = [0, this.stage.width() / 2, this.stage.width()];
    const horizontal = [0, this.stage.height() / 2, this.stage.height()];

    // and we snap over edges and center of each object on the canvas
    const layers = this.stage.getChildren();
    const shapes = layers.flatMap((layer) => layer.getChildren());
    shapes.forEach((guideItem) => {
      if (guideItem === skipShape) return;
      const box = guideItem.getClientRect();
      vertical.push(box.x, box.x + box.width, box.x + box.width / 2);
      horizontal.push(box.y, box.y + box.height, box.y + box.height / 2);
    });
    return {
      vertical: vertical.flat(),
      horizontal: horizontal.flat(),
    } as LineGuideStops;
  }

  getObjectSnappingEdges(node: any) {
    const box = node.getClientRect();
    const absPos = node.absolutePosition();

    return {
      vertical: [
        {
          guide: Math.round(box.x),
          offset: Math.round(absPos.x - box.x),
          snap: SnapDirection.start,
        } as ObjectBound,
        {
          guide: Math.round(box.x + box.width / 2),
          offset: Math.round(absPos.x - box.x - box.width / 2),
          snap: SnapDirection.center,
        } as ObjectBound,
        {
          guide: Math.round(box.x + box.width),
          offset: Math.round(absPos.x - box.x - box.width),
          snap: SnapDirection.end,
        } as ObjectBound,
      ],
      horizontal: [
        {
          guide: Math.round(box.y),
          offset: Math.round(absPos.y - box.y),
          snap: SnapDirection.start,
        } as ObjectBound,
        {
          guide: Math.round(box.y + box.height / 2),
          offset: Math.round(absPos.y - box.y - box.height / 2),
          snap: SnapDirection.center,
        } as ObjectBound,
        {
          guide: Math.round(box.y + box.height),
          offset: Math.round(absPos.y - box.y - box.height),
          snap: SnapDirection.end,
        } as ObjectBound,
      ],
    } as ObjectSnappingEdges;
  }

  // find all snapping possibilities
  getGuides(
    getLineGuideStops: LineGuideStops | undefined,
    itemBounds: ObjectSnappingEdges | undefined
  ) {
    if (!getLineGuideStops || !itemBounds) return;

    const resultV: LineGuide[] = [];
    const resultH: LineGuide[] = [];

    getLineGuideStops.vertical.forEach((lineGuide) => {
      itemBounds.vertical.forEach((itemBound) => {
        const diff = Math.abs(lineGuide - itemBound.guide);
        if (diff < this.GUIDELINE_OFFSET) {
          resultV.push({
            lineGuide: lineGuide,
            diff: diff,
            snap: itemBound.snap,
            offset: itemBound.offset,
          } as LineGuide);
        }
      });
    });

    getLineGuideStops.horizontal.forEach((lineGuide) => {
      itemBounds.horizontal.forEach((itemBound) => {
        const diff = Math.abs(lineGuide - itemBound.guide);
        if (diff < this.GUIDELINE_OFFSET) {
          resultH.push({
            lineGuide: lineGuide,
            diff: diff,
            snap: itemBound.snap,
            offset: itemBound.offset,
          } as LineGuide);
        }
      });
    });

    const guides: FinalLineGuide[] = [];

    //find closest snap
    const minV = resultV.sort((a, b) => a.diff - b.diff)[0];
    const minH = resultH.sort((a, b) => a.diff - b.diff)[0];
    if (minV) {
      guides.push({
        lineGuide: minV.lineGuide,
        offset: minV.offset,
        orientation: GuideOrientation.V,
        snap: minV.snap,
      } as FinalLineGuide);
    }
    if (minH) {
      guides.push({
        lineGuide: minH.lineGuide,
        offset: minH.offset,
        orientation: GuideOrientation.H,
        snap: minH.snap,
      } as FinalLineGuide);
    }

    return guides;
  }

  drawGuides(guides: FinalLineGuide[]) {
    if (!this.gridLayer) return;

    guides.forEach((lg) => {
      let line;

      // Create a vertical line (V orientation)
      if (lg.orientation === GuideOrientation.V) {
        line = new Konva.Line({
          points: [-6000, 0, 6000, 0],
          stroke: 'rgb(0, 161, 255)',
          strokeWidth: 1,
          name: 'guid-line',
          dash: [4, 6],
        });

        // Positioning the line correctly on the grid layer
        line.position({
          x: lg.lineGuide,
          y: 0,
        });
      } else if (lg.orientation === GuideOrientation.H) {
        // Create a horizontal line (H orientation)
        line = new Konva.Line({
          points: [0, -6000, 0, 6000],
          stroke: 'rgb(0,161, 255)',
          strokeWidth: 1,
          name: 'guid-line',
          dash: [4, 6],
        });

        // Positioning the line correctly on the grid layer
        line.position({
          x: 0,
          y: lg.lineGuide,
        });
      }

      if (line) {
        this.gridLayer?.add(line); // Add the line to the grid layer
        this.gridLayer?.draw(); // Ensure that the grid layer is redrawn
      }
    });
  }
  calculateConnectionPosition = (
    fromPos: Vector2d,
    toShape: Konva.Shape | Konva.Group
  ) => {
    const middlePoint = {
      x: toShape.x() + toShape.width() / 2,
      y: toShape.y() - toShape.y() / 2,
    };
    const topPos = { x: toShape.x() + toShape.width() / 2, y: toShape.y() };
    const leftPos = { x: toShape.x(), y: toShape.y() + toShape.height() / 2 };
    const rightPos = {
      x: toShape.x() + toShape.width(),
      y: toShape.y() + toShape.height() / 2,
    };
    const bottomPos = {
      x: toShape.x() + toShape.width() / 2,
      y: toShape.y() + toShape.width(),
    };
    const topDistance =
      Math.max(topPos.x, fromPos.x) -
      Math.min(topPos.x, fromPos.x) +
      Math.max(topPos.y, fromPos.y) -
      Math.min(topPos.y, fromPos.y);
    const leftDistance =
      Math.max(leftPos.x, fromPos.x) -
      Math.min(leftPos.x, fromPos.x) +
      Math.max(leftPos.y, fromPos.y) -
      Math.min(leftPos.y, fromPos.y);
    const rightDistance =
      Math.max(rightPos.x, fromPos.x) -
      Math.min(rightPos.x, fromPos.x) +
      Math.max(rightPos.y, fromPos.y) -
      Math.min(rightPos.y, fromPos.y);
    const bottomDistance =
      Math.max(bottomPos.x, fromPos.x) -
      Math.min(bottomPos.x, fromPos.x) +
      Math.max(bottomPos.y, fromPos.y) -
      Math.min(bottomPos.y, fromPos.y);
    switch (
      Math.min(topDistance, leftDistance, rightDistance, bottomDistance)
    ) {
      case topDistance: {
        return topPos;
      }
      case leftDistance: {
        return leftPos;
      }
      case rightDistance: {
        return rightPos;
      }
      case bottomDistance: {
        return bottomPos;
      }
      default: {
        return middlePoint;
      }
    }
  };

  insertBreakpoint(points: number[], x: number, y: number): void {
    // If there is no hovered path segment, return early
    if (this.hoveredPathSegment === undefined) return;

    // Convert the flat points array into pairs of [x, y] coordinates
    const pairs = points.reduce<number[][]>((result, value, index, array) => {
      if (index % 2 === 0) {
        result.push(array.slice(index, index + 2));
      }
      return result;
    }, []);

    // If there are at least two pairs of points, proceed
    if (pairs.length >= 2) {
      pairs.map((pair, index) => {
        // Check if the current pair matches the start of the hovered path segment
        if (
          pair[0] === this.hoveredPathSegment?.start.x &&
          pair[1] === this.hoveredPathSegment?.start.y
        ) {
          // Calculate the insertion index in the flat points array
          const actIndex = index * 2 + 2;

          // Insert the new breakpoint (x, y) into the points array at the calculated index
          points.splice(actIndex, 0, x, y);
        }
      });
    }
  }

  isSelectable(object: any): object is Selectable {
    return (
      object &&
      object.isSelected != null &&
      typeof object.isSelected == 'boolean'
    );
  }
}
