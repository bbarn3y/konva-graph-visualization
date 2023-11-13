/*
 * <<licensetext>>
 */

import { AfterViewInit, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import Konva from "konva";
import Shape = Konva.Shape;
import Group = Konva.Group;
import { ShapeType } from 'src/app/_models/shape-type';
import { RectangleShape } from 'src/app/_graphics/shapes/rectangle';
import { Vector2d } from 'konva/lib/types';

@Component({
  selector: 'app-graph-editor',
  templateUrl: './graph-editor.component.html',
  styleUrls: ['./graph-editor.component.less']
})
export class GraphEditorComponent implements AfterViewInit {
  @ViewChild('container') containerElement?: ElementRef<HTMLDivElement>;
  stage!: Konva.Stage;
  selectedLayer?: Konva.Layer;
  selectedShape?: ShapeType;
  placeHolderShape?: Konva.Shape | Konva.Group;
  gridLayer?: Konva.Layer;
  //@TODO: Put in configuration
  fieldSize: number = 100;
  windowWidth: number = 300;
  windowHeight: number = 300;
  scaleBy: number = 1.04;
  zoomLevel: number = 1
  clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);
  clampPos = (pos: Vector2d, min: number, max: number) => {
    return { x: Math.min(Math.max(pos.x, min), max), y: Math.min(Math.max(pos.y, min), max) }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    console.log('onResize', event);
    this.updateViewport();
    this.rePositionStage();
    this.updateGrid();
  }

  ShapeType = ShapeType;
  ngAfterViewInit(): void {
    this.initState(() => {
      this.addEventListeners();
    })
  }

  initState(callback: () => any) {
    setTimeout(() => {
    this.updateViewport();
    this.stage = new Konva.Stage({
      container: 'container',
      width: this.windowWidth,
      height: this.windowHeight,
      scaleY: -1,
      y: this.windowHeight,
      draggable: true
    })
      if (this.stage) {
        this.gridLayer = new Konva.Layer();
        this.stage.add(this.gridLayer);
        const layer = new Konva.Layer();
        this.stage.add(layer);
        console.log('stage', this.stage.getLayers());
        this.selectedLayer = this.stage.getLayers()[1];
        this.stage.getLayers().map((layer) => layer.draw());
        this.adjustZoomLevel();
      }
      callback();
    }, 0)
  }

  addEventListeners() {
    if(!this.stage) {
      return;
    }
    let outerThis = this;
    this.stage.on('click', (event) => {
      const pointerPosition = this.stage?.getRelativePointerPosition();
      if (!pointerPosition) return;
      console.log('Clicked on stage', pointerPosition);
      const snapPos = this.calculateGridSnapPosition(pointerPosition);
      if (this.selectedShape) {
        this.drawShape(this.selectedShape, snapPos.x, snapPos.y, true);
      }
    });
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
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;
      const mousePointTo = {
        x: (pointer.x - this.stage.x()) / oldScale,
        y: (pointer.y - this.stage.y()) / oldScale
      };
      const direction = event.evt.deltaY > 0 ? -1 : 1;
      //Zoom out or Zoom in based on wheel dierction, scaleBy is the zooming 'strength'
      const newScaleTemp = direction > 0 ? oldScale * this.scaleBy : oldScale / this.scaleBy;
      //Clamp scale to earn min-max zoom levels
      const newScale = this.clamp(newScaleTemp, 0.5, 1.4)
      //Add the clamped scale to stage
      this.stage.scale({ x: newScale, y: -newScale });

      //Move the a bit based on the pointer position. (Slightly moving towards to pointer)
      //Note:Might delete this becaous of clamped stage coords
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale
      }

      //Update the grid
      this.rePositionStage(newPos);
      //Modify the zoomLevel based on the stage scale.
      this.adjustZoomLevel(newScale);
      this.stage.setPointersPositions(event);
    })
  }

  drawShape(shapeType: ShapeType, x: number, y: number, draggable: boolean = false) {
    const shapeSize = this.calculateShapeSize();
    console.log('drawShape', shapeType, x, y);
    if(this.stage && this.selectedLayer) {
      let shape;
      switch(shapeType) {
        case ShapeType.RECTANGLE:
          shape = new RectangleShape(this.stage, x, y, shapeSize.x, shapeSize.y, draggable).shape();
          shape.on('dragstart', (e) => {
            console.log('DragStart', e);
            e.currentTarget.moveToTop();
          });
          shape.on('dragend', (e) => {
            console.log('DragEnd', e);
            e.currentTarget.position(this.calculateGridSnapPosition(e.currentTarget.getPosition()));
          });
          shape.on('dragmove', (e) => {
            console.log('DragMove', e);
            e.currentTarget.position(this.calculateGridSnapPosition(e.currentTarget.getPosition()));
          });
          break;
        default:
          break;
      }

      if(!shape) {
        return;
      }
      this.selectedLayer.add(shape);
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
      x: (Math.round(vector.x / weightedFieldSize) * weightedFieldSize + padding),
      y: ((Math.round(vector.y / weightedFieldSize) * weightedFieldSize) + (weightedFieldSize - shapeSize.y) - weightedFieldSize - padding),
    }
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
    console.log('Viewport updated!', this.windowWidth, this.windowHeight, window.innerWidth, window.innerHeight);
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
    const weightedFieldSize = this.fieldSize * Math.max(this.zoomLevel,1);
    const stageWidth = 2000 * Math.max(this.zoomLevel,1);
    const stageHeight = 2000 * Math.max(this.zoomLevel,1);
    //Starting and last x axis coord for loop
    //Draw lines based of the current stage position, the stage width (viewport) and the gridSize based on zoomLevel
    const startX = Math.floor((-this.stage.x() - stageWidth) / weightedFieldSize) * weightedFieldSize;
    const endX = Math.floor((-this.stage.x() + stageWidth) / weightedFieldSize) * weightedFieldSize * this.zoomLevel;

    //Starting and last y axis coord for loop
    const startY = Math.floor((-this.stage.y() - stageHeight) / weightedFieldSize) * weightedFieldSize;
    const endY = Math.floor((-this.stage.y() + stageHeight) / weightedFieldSize) * weightedFieldSize * this.zoomLevel;
    //In every loop we draw a line in every direction
    //then increasing the current x pos by gridSize
    for (let x = startX; x < endX; x += weightedFieldSize) {
              this.gridLayer.add(
          new Konva.Line({
          points: [x, 0, x, startY - endY],
          stroke: '#ddd',
          strokeWidth: 4,
          listening: false
          })
        );
        this.gridLayer.add(
          new Konva.Line({
          points: [-x, 0, -x, endY - startY],
          stroke: '#ddd',
          strokeWidth: 4,
          listening: false
          })
        );

        this.gridLayer.add(
          new Konva.Line({
          points: [x, 0, x, endY - startY],
          stroke: '#ddd',
          strokeWidth: 4,
          listening: false
          })
        );
        this.gridLayer.add(
          new Konva.Line({
          points: [-x, 0, -x, startY - endY],
          stroke: '#ddd',
          strokeWidth: 4,
          listening: false
          })
      );
      this.gridLayer.batchDraw();
    }
    //We do same on the Y axis
    for (let y = startY; y < endY; y += weightedFieldSize) {
        this.gridLayer.add(
          new Konva.Line({
          points: [0, y, startX - endX, y],
          stroke: '#ddd',
          strokeWidth: 4,
          listening: false
          })
        );
        this.gridLayer.add(
          new Konva.Line({
          points: [0, y, endX - startX, y],
          stroke: '#ddd',
          strokeWidth: 4,
          listening: false
          })
        );

        this.gridLayer.add(
          new Konva.Line({
          points: [0, -y, endX - startX, -y],
          stroke: '#ddd',
          strokeWidth: 4,
          listening: false
          })
        );
        this.gridLayer.add(
          new Konva.Line({
          points: [0, -y, startY - endY, -y],
          stroke: '#ddd',
          strokeWidth: 4,
          listening: false
          })
      );
      this.gridLayer.batchDraw();
    }
  }

  //Adjust the zoomLevel based on current stage scale or the given value.
  adjustZoomLevel(scale?: number) {
    if (!scale) scale = this.stage.scaleX();
    //@TODO: Add to configuration
    if (scale >= 1.3) {
      this.zoomLevel = 1;
    } else if (scale > 0.7){
      this.zoomLevel = 2;
    } else {
      this.zoomLevel = 4;
    }
    this.updateGrid();
  }

  //Reposition stage, but the coords are clamped and based on zoom level.
  rePositionStage(pos?: Vector2d) {
    if (!pos) pos = this.stage.position();
    const range: number = this.stage.width() / this.zoomLevel;
    this.stage.setPosition(
      this.clampPos(
          pos,
          -(Math.floor(range)),
          Math.floor(range)
        )
    )
  }

  //
  //Drag events from toolbar
  //
  shapeMenuItemDragStarted(shapeType: ShapeType, e?: Event) {
    this.selectedShape = shapeType;
  }

  //Dropped on a Konva stage
  onDrop(e: Event) {
    console.log('On drop', e);
    e.preventDefault();
    if(!this.stage || !this.selectedShape) {
      return;
    }
    this.stage.setPointersPositions(e);
    if (!this.stage.pointerPos) return;
    const pointerPos = this.stage.getRelativePointerPosition()
    if (!pointerPos) return;
    const snapPos = this.calculateGridSnapPosition(pointerPos);
      if(this.stage.pointerPos) {
        this.drawShape(this.selectedShape, snapPos.x, snapPos.y, true)
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
    const pointerPos = this.stage.getRelativePointerPosition()
    if (!pointerPos) return;
    const snapPos = this.calculateGridSnapPosition(pointerPos);
    //Draw placeholderShape
    if (!this.placeHolderShape) {
      this.placeHolderShape = this.drawShape(this.selectedShape, snapPos.x, snapPos.y, true);
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
    console.log('DragLeave', e);
    if (!this.placeHolderShape) return;
    //Remove placeholder shape;
    this.placeHolderShape.remove();
    this.placeHolderShape = undefined;
  }

  onDragEnd(e: Event) {
    e.preventDefault();
    console.log('DragEnd', e);
  }

}
