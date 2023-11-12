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
  fieldSize: number = 100;
  windowWidth: number = 300;
  windowHeight: number = 300;

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    console.log('onResize', event);
    this.updateViewport();
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
    })
      if (this.stage) {
        this.gridLayer = new Konva.Layer();
        this.updateGrid();
        this.stage.add(this.gridLayer);
        const layer = new Konva.Layer();
        this.stage.add(layer);
        console.log('stage', this.stage.getLayers());
        this.selectedLayer = this.stage.getLayers()[1];
        this.stage.getLayers().map((layer) => layer.draw());
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
      const snapPos = this.calculateGridSnapPosition(pointerPosition);
      if (this.selectedShape) {
        this.drawShape(this.selectedShape, snapPos.x, snapPos.y, true);
      }
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
            this.stage.batchDraw();
          });
          shape.on('dragmove', (e) => {
            console.log('DragMove', e);
            e.currentTarget.position(this.calculateGridSnapPosition(e.currentTarget.getPosition()));
            this.stage.batchDraw();
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
  calculateGridSnapPosition(vector: Vector2d): Vector2d {
    const padding = 10;
    const shapeSize = this.calculateShapeSize();
    const pos = {
      x: Math.round(vector.x / this.fieldSize) * this.fieldSize + padding,
      y: (Math.round(vector.y / this.fieldSize) * this.fieldSize) + (this.fieldSize - shapeSize.y) - this.fieldSize - padding,
    }
    return pos;
  }

  calculateShapeSize(): Vector2d {
    //@TODO: Add Zoom level based calculation
    const size = Math.round(this.fieldSize / 4); // * this.zoomLevel;
    const shapeSize = {
      x: size,
      y: size,
    }
    return shapeSize;
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
    this.updateGrid();
  }

  updateGrid() {
    if (!this.gridLayer) return;
    console.log('gridLayer', this.gridLayer);
    if (this.gridLayer.children.length > 0) {
      this.gridLayer.removeChildren();
    }
    for (let i = 0; i < this.windowWidth / this.fieldSize; i++) {
      this.gridLayer.add(
        new Konva.Line({
          points: [Math.round(i * this.fieldSize) + 0.5, 0, Math.round(i * this.fieldSize) + 0.5, this.windowHeight],
          stroke: '#ddd',
          strokeWidth: 1,
          listening: false
        })
      )
    }
    this.gridLayer.add(new Konva.Line({ points: [0, 0, 10, 10] }));
    for (let j = 0; j < this.windowHeight / this.fieldSize; j++) {
      this.gridLayer.add(new Konva.Line({
        points: [0, Math.round(j * this.fieldSize), this.windowWidth, Math.round(j * this.fieldSize)],
        stroke: '#ddd',
        strokeWidth: 1,
        listening: false
      }));
    }
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
    const invertedY = (this.stage.pointerPos.y - this.stage.height()) * -1;
    const snapPos = this.calculateGridSnapPosition({x: this.stage.pointerPos.x, y:invertedY});
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
    const invertedY = (this.stage.pointerPos.y - this.stage.height()) * -1;
    const snapPos = this.calculateGridSnapPosition({x: this.stage.pointerPos.x, y:invertedY});
    if (!this.placeHolderShape) {
      this.placeHolderShape = this.drawShape(this.selectedShape, snapPos.x, snapPos.y, true);
      this.placeHolderShape?.opacity(0.5);
    }
    if (this.placeHolderShape) {
      this.placeHolderShape.position(snapPos);
    }
  }

  //A dragged shape leaves the konva stage.
  onDragLeave(e: Event) {
    e.preventDefault();
    console.log('DragLeave', e);
    if (!this.placeHolderShape) return;
    this.placeHolderShape.remove();
    this.placeHolderShape = undefined;
  }

  onDragEnd(e: Event) {
    e.preventDefault();
    console.log('DragEnd', e);
  }

}
