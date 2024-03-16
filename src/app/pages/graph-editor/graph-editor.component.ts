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
import Shape = Konva.Shape;
import Group = Konva.Group;
import { ShapeType } from 'src/app/_models/shape-type';
import { RectangleShape } from 'src/app/_graphics/shapes/rectangle';
import { Vector2d } from 'konva/lib/types';
import { from, last } from 'rxjs';
import { Breakpoint } from 'src/app/_graphics/shapes/breakpoint';
import {
  FinalLineGuide,
  GuideOrientation,
  LineGuide,
  LineGuideStops,
  ObjectBound,
  ObjectSnappingEdges,
  SnapDirection,
} from 'src/app/_interfaces/shapeTypes';
import { KonvaEventObject } from 'konva/lib/Node';
import { PlaceholderShapes } from 'src/app/_constants/placeholderShapes';
import { RGBA } from 'konva/lib/filters/RGBA';
import { defaultShapes } from 'src/app/_constants/defaultShapes';

@Component({
  selector: 'app-graph-editor',
  templateUrl: './graph-editor.component.html',
  styleUrls: ['./graph-editor.component.less'],
})
export class GraphEditorComponent implements AfterViewInit {
  @ViewChild('container') containerElement?: ElementRef<HTMLDivElement>;
  @ViewChild('contextMenu') contextMenuElement?: ElementRef<HTMLDivElement>;
  stage!: Konva.Stage;
  selectedLayer?: Konva.Layer;
  selectedShape?: ShapeType;
  static IdCount = 1;
  selectRectangle?: Konva.Rect;
  groups: Konva.Group[] = [];
  //currentShape?: Konva.Shape;
  placeHolderShape?: Konva.Shape | Konva.Group;
  clickedShape?: Konva.Shape;
  gridLayer?: Konva.Layer;
  placeholderLayer?: Konva.Layer;
  //@TODO: Put in configuration
  fieldSize: number = 100;
  windowWidth: number = 300;
  windowHeight: number = 300;
  scaleBy: number = 1.04;
  zoomLevel: number = 1;
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
  placeholderArrow = PlaceholderShapes.placeHolderArrow;
  placeholderConnection = PlaceholderShapes.placeHolderConnectionCircle;
  isDrawingLine: boolean = false;
  breakpointsById: { [k: string]: Breakpoint[] } = {};
  linesById: { [k: string]: (Konva.Line | Konva.Arrow)[] } = {};
  currentLineId?: string;
  breakpoints: Breakpoint[] = [];
  currentBreakpoint?: Breakpoint;

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.updateViewport();
    this.rePositionStage();
    //this.updateGrid();
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
      this.stage = new Konva.Stage({
        container: 'container',
        width: this.windowWidth,
        height: this.windowHeight,
        draggable: false,
      });
      if (this.stage) {
        this.gridLayer = new Konva.Layer();
        this.stage.add(this.gridLayer);
        this.gridLayer.on('dragmove', (e) => {
          this.gridLayer?.find('.guid-line').forEach((l) => l.destroy());

          const lineGuideStops = this.getLineGuideStops(e.target);
          const itemBounds = this.getObjectSnappingEdges(e.target);
          const guides = this.getGuides(lineGuideStops, itemBounds);

          if (!guides || !guides.length) {
            return;
          }

          this.drawGuides(guides);

          const absPos = e.target.getAbsolutePosition();
          guides.forEach((lg) => {
            switch (lg.snap) {
              case SnapDirection.start: {
                switch (lg.orientation.toString()) {
                  case GuideOrientation.V.toString(): {
                    absPos.x = lg.lineGuide + lg.offset;
                    break;
                  }
                  case GuideOrientation.H.toString(): {
                    absPos.y = lg.lineGuide + lg.offset;
                    break;
                  }
                }
                break;
              }
              case SnapDirection.center: {
                switch (lg.orientation.toString()) {
                  case GuideOrientation.V.toString(): {
                    absPos.x = lg.lineGuide + lg.offset;
                    break;
                  }
                  case GuideOrientation.H.toString(): {
                    absPos.y = lg.lineGuide + lg.offset;
                    break;
                  }
                }
                break;
              }
              case SnapDirection.end: {
                switch (lg.orientation.toString()) {
                  case GuideOrientation.V.toString(): {
                    absPos.x = lg.lineGuide + lg.offset;
                    break;
                  }
                  case GuideOrientation.H.toString(): {
                    absPos.y = lg.lineGuide + lg.offset;
                    break;
                  }
                }
                break;
              }
            }
          });
          e.target.absolutePosition(absPos);
        });

        this.gridLayer.on('dragend', (e) => {
          layer.find('.guid-line').forEach((l) => l.destroy());
        });
        const layer = new Konva.Layer();
        this.stage.add(layer);
        this.selectedLayer = this.stage.getLayers()[1];

        this.placeholderLayer = new Konva.Layer();
        this.placeholderLayer.add(this.placeholderConnection);
        this.stage.add(this.placeholderLayer);

        this.stage.getLayers().map((layer) => layer.draw());
        this.adjustZoomLevel();
      }
      callback();
    }, 0);
  }

  addEventListeners() {
    if (!this.stage) {
      return;
    }
    let outerThis = this;

    if (!this.selectedLayer) {
      return;
    }

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
        (this.isDrawingLine &&
          this.currentLineId &&
          clickTarget instanceof Konva.Shape) ||
          clickTarget instanceof Konva.Group
      ) {
        //this.addArrow(this.calculateCenterPosition(shape));
        this.addArrow(this.calculateConnectionPosition(pointerPosition, clickTarget));
      } else if (this.isDrawingLine && this.currentLineId) {
        const points = this.placeholderArrow.points();
        if (!this.breakpointsById[this.currentLineId])
          this.breakpointsById[this.currentLineId] = [];
        const tempLine = defaultShapes.connectionLine.clone().points(points);
        this.linesById[this.currentLineId].push(tempLine);
        this.selectedLayer?.add(tempLine);
        const tempBreakPoint = new Breakpoint(
          this.stage,
          points[2],
          points[3],
          true,
          this.currentLineId,
          this.breakpointsById[this.currentLineId].length
        );
        this.breakpointsById[this.currentLineId].push(tempBreakPoint);

        const shape = tempBreakPoint.shape();
        shape.on('dragmove', (e) => {
          const pointerPos = this.stage.getRelativePointerPosition();
          if (!pointerPos) return;
          tempBreakPoint.x = pointerPos.x;
          tempBreakPoint.y = pointerPos.y;
          this.updateLinesById(tempBreakPoint.lineId);
        });
        this.selectedLayer?.add(shape);
        this.updateLinesById(this.currentLineId);
        this.placeholderArrow.points([
          points[2],
          points[3],
          pointerPosition.x,
          pointerPosition.y,
        ]);
        //this.addBreakpoint({x: points[2], y: points[3]});
      } else if (this.selectedShape) {
        this.drawShape(this.selectedShape, snapPos.x, snapPos.y, true);
      }

      // Handling shape selection and unselection
      if (clickTarget === this.stage) {
        const selectedShapes = this.stage?.find('Shape').filter((x) => x.attrs.isSelected);

        if (!selectedShapes) return;

        selectedShapes.forEach((actShape) => {
          if (actShape instanceof Konva.Shape) {
            actShape.attrs.isSelected = false;
            actShape.stroke('black');
          }
        });
      } else if (clickTarget instanceof Konva.Shape &&
        event.evt.button !== 2 &&
        !this.selectedShape) {
        
        
        if (event.evt.ctrlKey) {
          if (clickTarget.attrs.isSelected) {
            clickTarget.attrs.unselectShape(clickTarget);
          } else {
            clickTarget.attrs.selectShape(clickTarget);
          }
        }
        else if (clickTarget instanceof Konva.Shape) {
          const selectedShapes = this.stage?.find('Shape').filter((x) => x.attrs.isSelected);
          console.log(selectedShapes);
          
          if (!selectedShapes) return;

          selectedShapes.forEach((actShape) => {
            if (actShape instanceof Konva.Shape) {
              actShape.attrs.unselectShape(actShape);
            }
          });

          clickTarget.attrs.isSelected ? clickTarget.attrs.unselectShape(clickTarget) : clickTarget.attrs.selectShape(clickTarget); 
        }
        
       /*
        if (event.evt.ctrlKey) {
          if (clickTarget.attrs.isSelected) {
            clickTarget.attrs.isSelected = false;
            clickTarget.stroke('black');
          } else {
            clickTarget.attrs.isSelected = true;
            clickTarget.stroke('yellow');
          }
        }
        else if (clickTarget instanceof Konva.Shape) {
          const selectedShapes = this.stage?.find('Shape').filter((x) => x.attrs.isSelected);

          if (!selectedShapes) return;

          selectedShapes.forEach((actShape) => {
            if (actShape instanceof Konva.Shape) {
              actShape.attrs.isSelected = false;
              actShape.stroke('black');
            }
          });

          clickTarget.attrs.isSelected = !clickTarget.attrs.isSelected;
          clickTarget.stroke(clickTarget.attrs.isSelected ? 'yellow' : 'black');
        }
        */
        // Handling group selection and unselection
        if (clickTarget.attrs.group !== undefined) {
          if (clickTarget.attrs.isSelected) {
            const sameGroupShapes = this.stage?.find('Shape').filter((x) => x.attrs.group === clickTarget.attrs.group);

            if (!sameGroupShapes) return;

            sameGroupShapes.forEach((actShape) => {
              if (
                actShape instanceof Konva.Shape &&
                actShape.attrs.group !== undefined
              ) {
                actShape.attrs.isSelected = true;
                actShape.stroke('yellow');
              }
            });
          }
          else {
            const sameGroupShapes = this.stage?.find('Shape').filter((x) => x.attrs.group === clickTarget.attrs.group);

            if (!sameGroupShapes) return;

            sameGroupShapes.forEach((actShape) => {
              if (
                actShape instanceof Konva.Shape &&
                actShape.attrs.group !== undefined
              ) {
                actShape.attrs.isSelected = false;
                actShape.stroke('black');
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
    //Dragging the stage
    this.stage.on('dragmove', (e) => {
      this.rePositionStage();
    });
    this.stage.on('dragend', (e) => {
      this.rePositionStage();
    });
    //Scroll event
    this.stage.on('wheel', (event) => {
      event.evt.preventDefault();
      const oldScale = this.stage.scaleX();
      const pointer = this.stage.getRelativePointerPosition();
      if (!pointer) return;
      const mousePointTo = {
        x: (pointer.x - this.stage.x()) / oldScale,
        y: (pointer.y - this.stage.y()) / oldScale,
      };
      const direction = event.evt.deltaY > 0 ? -1 : 1;
      //Zoom out or Zoom in based on wheel dierction, scaleBy is the zooming 'strength'
      const newScaleTemp =
        direction > 0 ? oldScale * this.scaleBy : oldScale / this.scaleBy;
      //Clamp scale to earn min-max zoom levels
      const newScale = this.clamp(newScaleTemp, 0.5, 1.4);
      //Add the clamped scale to stage
      this.stage.scale({ x: newScale, y: newScale });

      //Move the a bit based on the pointer position. (Slightly moving towards to pointer)
      //Note:Might delete this because of clamped stage coords
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      //Update the grid
      this.rePositionStage(newPos);
      //Modify the zoomLevel based on the stage scale.
      this.adjustZoomLevel(newScale);
      this.stage.setPointersPositions(event);
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

      //Check if target is grouped or not
      if (e.target.attrs?.group !== undefined && e.target.attrs?.isSelected) {
        this.isGrouped = true;
      } else {
        this.isGrouped = false;
      }

      //Check if all the selected shapes are in the same group
      const selectedShapes = this.stage?.find('Shape').filter((x) => x.attrs.isSelected);
      this.onlySameGroupElements =
        selectedShapes.every(
          (shape) =>
            shape.attrs.group === selectedShapes[0].attrs.group &&
            shape.attrs.group !== undefined
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

      //Update placeholderArrow points based on pointer pos
      if (this.isDrawingLine) {
        this.updateArrow();
        return;
      }
    });

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
          actShape.attrs.isSelected = true;
          actShape.stroke('yellow');
        });

        this.selectRectangle.destroy();
        this.selectRectangle = undefined;
        this.selectedLayer?.batchDraw();
      }
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
    draggable: boolean = false
  ) {
    const shapeSize = this.calculateShapeSize();
    if (this.stage && this.selectedLayer) {
      let shape;
      switch (shapeType) {
        case ShapeType.RECTANGLE:
          let shape2 = new RectangleShape(
            this.stage,
            x,
            y,
            shapeSize.x,
            shapeSize.y,
            draggable
          );//.shape();
          console.log("custom rect " + JSON.stringify(shape2));
          
          
          shape = shape2.konvaShape;
          console.log("shape " + shape);
          
          shape.on('dragstart', (e) => {
            this.placeholderConnection.opacity(0);
            e.currentTarget.moveToTop();
          });
          shape.on('dragend', (e) => {
            e.currentTarget.position(
              this.calculateGridSnapPosition(e.currentTarget.getPosition())
            );
          });
          shape.on('dragmove', (e) => {
            e.currentTarget.position(
              this.calculateGridSnapPosition(e.currentTarget.getPosition())
            );
          });
          shape.on('dblclick', (e) => {
            if (
              e.currentTarget instanceof Konva.Shape ||
              e.currentTarget instanceof Konva.Group
            ) {
              this.selectedLayer?.add(this.placeholderArrow);
              this.currentLineId = e.currentTarget.id();
              if (!this.currentLineId) return;
              this.isDrawingLine = true;
              this.linesById[this.currentLineId] = [];
              this.drawArrow(
                this.calculateConnectionPosition(
                  this.stage.getRelativePointerPosition()!,
                  e.currentTarget
                )
              );
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
              this.placeholderConnection.position(
                this.calculateConnectionPosition(pointerPos, e.currentTarget)
              );
              this.placeholderConnection.opacity(0.65);
            }
          });

          shape.on('mouseout', (e) => {
            this.placeholderConnection.opacity(0);
          });
          break;
        default:
          break;
      }

      if (!shape) {
        return;
      }

      shape.attrs.id = GraphEditorComponent.IdCount++;
      this.selectedLayer.add(shape);
      console.log(shape);
      
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
    const gridLine = defaultShapes.gridLine;
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

  //Adjust the zoomLevel based on current stage scale or the given value.
  adjustZoomLevel(scale?: number) {
    if (!scale) scale = this.stage.scaleX();
    //@TODO: Add to configuration
    if (scale >= 1.3) {
      this.zoomLevel = 1;
    } else if (scale > 0.7) {
      this.zoomLevel = 2;
    } else {
      this.zoomLevel = 4;
    }
    this.updateGrid();
  }

  //Reposition stage, but the coords are clamped and based on zoom level.
  rePositionStage(pos?: Vector2d) {
    if (!pos) pos = this.stage.position();
    const range: number = this.stage.width();
    this.stage.setPosition(
      this.clampPos(pos, -Math.floor(range), Math.floor(range))
    );
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
      if (actShape.attrs.isSelected === undefined) return;
      if (actShape instanceof Konva.Shape && actShape.attrs.isSelected) {
        actShape.attrs.isSelected = false;
        actShape.stroke('black');
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

    const allShapes = this.stage?.find('Shape');
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

    const selectedShapes = this.stage?.find('Shape').filter((x) => x.attrs.isSelected);

    if (!selectedShapes) return;

    // preprocess shapes if already in group(s)
    const isRegroupingNeeded = selectedShapes.some(
      (x) => x.attrs.group !== undefined
    );

    const groupsToDelete: Konva.Group[] = [];

    selectedShapes.forEach((actShape) => {
      if (
        actShape.attrs.group !== undefined &&
        !groupsToDelete.includes(actShape.attrs.group)
      ) {
        groupsToDelete.push(actShape.attrs.group);

        actShape.attrs.group = undefined;
      }
    });

    groupsToDelete.forEach((actGroup) => {
      const index = this.groups.indexOf(actGroup);

      if (index !== -1) {
        this.groups.splice(index, 1);
      }
    });

    // groups all the shapes that are selected
    selectedShapes.forEach((actShape) => {
      if (actShape instanceof Konva.Shape) {
        actShape.stroke('black');
        actShape.attrs.groupId = group.attrs.id;
        actShape.attrs.group = group;
        group.add(actShape);
      }
      actShape.attrs.isSelected = false;
    });

    //currentShape.attrs.group = group;

    this.selectedLayer?.add(group);
    this.selectedLayer?.draw();
    this.groups.push(group);
    this.isShowContextMenu = false;
    this.clickedShape = undefined;
  }

  //Ungroups the selected shapes
  public ungroupSelectedShapes(): void {
    const selectedShapes = this.stage?.find('Shape').filter((x) => x.attrs.isSelected);

    if (!selectedShapes) return;

    const groupToDelete = this.clickedShape?.attrs.group;

    selectedShapes.forEach((actShape) => {
      if (actShape.attrs.group === groupToDelete) {
        actShape.attrs.group = undefined;
      }
      if (actShape instanceof Konva.Shape) {
        actShape.stroke('black');
      }
      actShape.attrs.isSelected = false;
    });

    //this.groups.filter(group => group !== groupToDelete);
    const index = this.groups.indexOf(groupToDelete);
    if (index !== -1) {
      this.groups.splice(index, 1);
    }

    this.isShowContextMenu = false;
    this.clickedShape = undefined;
  }

  //Deletes the clicked shape
  public deleteShape(): void {
    if (this.clickedShape === undefined) return;

    const sameGroupShapes = this.stage?.find('Shape').filter((x) => x.attrs.group === this.clickedShape?.attrs.group);

    if (sameGroupShapes.length < 3) {
      const groupToDelete = this.clickedShape.attrs.group;

      sameGroupShapes.forEach((actShape) => {
        actShape.attrs.group = undefined;
      });

      //this.groups = this.groups.filter(group => group !== groupToDelete);
      const index = this.groups.indexOf(groupToDelete);
      if (index !== -1) {
        this.groups.splice(index, 1);
      }
    }

    this.clickedShape.destroy();
    this.isShowContextMenu = false;
    this.clickedShape = undefined;

    const selectedShapes = this.stage?.find('Shape').filter((x) => x.attrs.isSelected);

    if (!selectedShapes) return;

    selectedShapes.forEach((actShape) => {
      if (actShape instanceof Konva.Shape) {
        actShape.stroke('black');
      }
      actShape.attrs.isSelected = false;
    });
  }
  /*
  showContextMenu(event: MouseEvent): void {
    // Get the context menu element
    const contextMenu = document.getElementById('contextMenu');

    if (contextMenu) {
      // Set position based on the mouse pointer
      contextMenu.style.display = 'block';
      contextMenu.style.top = event.clientY + 'px';
      contextMenu.style.left = event.clientX + 'px';

      // Handle context menu actions
      document.getElementById('delete_button')?.addEventListener('click', () => {
        this.currentShape.destroy();
        contextMenu.style.display = 'none';
      });

      // Add other context menu options and their respective handlers as needed
    }
  }
  */
  //Arrow related
  updateLinesById(id: string): void {
    if (!this.linesById[id] || !this.breakpointsById[id]) return;
    if (this.linesById[id].length <= 0) return;
    if (
      this.linesById[id].length < this.breakpointsById[id].length &&
      this.linesById[id].length > 1
    ) {
      this.breakpointsById[id].pop();
      this.updateLinesById(id);
      return;
    }
    const lastIndex = this.linesById[id].length - 1;
    this.linesById[id].forEach((line, index) => {
      if (index === 0) {
        const br = this.breakpointsById[id][index];
        const points = this.linesById[id][index].points();
        const firstPos = {
          x: points[0],
          y: points[1],
        } as Vector2d;
        line.points([firstPos.x, firstPos.y, br.x, br.y]);
      } else if (index === lastIndex) {
        const br = this.breakpointsById[id][index - 1];
        const points = this.linesById[id][index].points();
        const lastPos = {
          x: points[2],
          y: points[3],
        } as Vector2d;
        line.points([br.x, br.y, lastPos.x, lastPos.y]);
      } else {
        const br = this.breakpointsById[id][index];
        const prevBr = this.breakpointsById[id][index - 1];
        line.points([prevBr.x, prevBr.y, br.x, br.y]);
      }
    });
  }

  addArrow(endPos: Vector2d) {
    if (!this.currentLineId) return;
    if (
      !this.linesById[this.currentLineId] ||
      !this.breakpointsById[this.currentLineId]
    )
      return;
    const tempArrow = this.placeholderArrow.clone();
    const tempPoints = tempArrow.points();

    tempArrow.points([tempPoints[0], tempPoints[1], endPos.x, endPos.y]);
    tempArrow.opacity(1);
    this.linesById[this.currentLineId].push(tempArrow);
    this.selectedLayer?.add(tempArrow);
    this.cancelDrawLine();
  }

  drawArrow(fromPos: Vector2d) {
    const pointerPos = this.stage.getRelativePointerPosition();
    if (!pointerPos) return;
    pointerPos.x;
    const deltaX = pointerPos.x - 10 - fromPos.x;
    const deltaY = pointerPos.y - 10 - fromPos.y;
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    const snappedAngle = this.snapToAngle(angle, 90, 5);

    const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const snappedX =
      fromPos.x + length * Math.cos((snappedAngle * Math.PI) / 180);
    const snappedY =
      fromPos.y + length * Math.sin((snappedAngle * Math.PI) / 180);
    this.placeholderArrow.points([fromPos.x, fromPos.y, snappedX, snappedY]);
    this.selectedLayer?.add(this.placeholderArrow);
  }
  // drawLine(fromPos: Vector2d, toPos: Vector2d) {
  //   //@TODO: Add to config
  //   const line = new Konva.Line({
  //     points: [fromPos.x, fromPos.y, toPos.x, toPos.y],
  //     stroke: 'black',
  //     width: 5,
  //     draggable: false
  //   })
  //   this.selectedLayer?.add(line);
  // }

  snapToAngle(angle: number, targetAngle: number, threshold: number) {
    const snappedAngle = Math.round(angle / targetAngle) * targetAngle;
    const diff = Math.abs(angle - snappedAngle);
    return diff <= threshold ? snappedAngle : angle;
  }
  updateArrow() {
    const pointerPos = this.stage.getRelativePointerPosition();
    if (!pointerPos) return;
    const startPoints = {
      x: this.placeholderArrow.points()[0],
      y: this.placeholderArrow.points()[1],
    };
    this.selectedLayer?.add(this.placeholderArrow);
    const snapPos = this.snapToAngleHelper(startPoints, pointerPos);
    this.placeholderArrow.points([
      startPoints.x,
      startPoints.y,
      snapPos.x,
      snapPos.y,
    ]);
  }

  cancelDrawLine() {
    this.isDrawingLine = false;
    this.placeholderArrow.remove();
    this.currentLineId = undefined;
  }

  snapToAngleHelper(startPos: Vector2d, endPos: Vector2d) {
    const deltaX = endPos.x - startPos.x;
    const deltaY = endPos.y - startPos.y;
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    const snappedAngle = this.snapToAngle(angle, 90, 5);

    const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const snappedX =
      startPos.x + length * Math.cos((snappedAngle * Math.PI) / 180);
    const snappedY =
      startPos.y + length * Math.sin((snappedAngle * Math.PI) / 180);

    return { x: snappedX, y: snappedY } as Vector2d;
  }

  newBreakpoint(pos: Vector2d) {
    return new Breakpoint(this.stage, pos.x, pos.y, true, '', 0);
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
      if (lg.orientation === GuideOrientation.V) {
        const line = new Konva.Line({
          points: [-6000, 0, 6000, 0],
          stroke: 'rgb(0, 161, 255)',
          strokeWidth: 1,
          name: 'guid-line',
          dash: [4, 6],
        });
        this.gridLayer?.add(line);
        line.absolutePosition({
          x: 0,
          y: lg.lineGuide,
        });
      } else if (lg.orientation === GuideOrientation.H) {
        const line = new Konva.Line({
          points: [0, -6000, 0, 6000],
          stroke: 'rgb(0,161, 255)',
          strokeWidth: 1,
          name: 'guid-line',
          dash: [4, 6],
        });
        this.gridLayer?.add(line);
        line.absolutePosition({
          x: lg.lineGuide,
          y: 0,
        });
      }
    });
  }

  //Center of shape
  calculateCenterPosition(shape: Konva.Shape | Konva.Group) {
    return {
      x: shape.x() + shape.width() / 2,
      y: shape.y() + shape.height() / 2,
    } as Vector2d;
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
}
