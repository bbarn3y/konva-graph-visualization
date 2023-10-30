/*
 * <<licensetext>>
 */

import { AfterViewInit, Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import Konva from "konva";
import Shape = Konva.Shape;
import Group = Konva.Group;
import { ShapeType } from 'src/app/_models/shape-type';
import { RectangleShape } from 'src/app/_graphics/shapes/rectangle';

@Component({
  selector: 'app-graph-editor',
  templateUrl: './graph-editor.component.html',
  styleUrls: ['./graph-editor.component.less']
})
export class GraphEditorComponent implements AfterViewInit {
  @ViewChild('container') containerElement?: ElementRef<HTMLDivElement>;
  stage?: Konva.Stage;
  selectedLayer?: Konva.Layer;
  selectedShape?: ShapeType;
  selectedShapes: Konva.Shape[] = [];



  ShapeType = ShapeType;
  ngAfterViewInit(): void {
    this.initState(() => {
      this.addEventListeners();
    })
  }

  initState(callback: () => any) {
    setTimeout(() => {
      //TODO:Include margins and padding to size
      this.stage = new Konva.Stage({
        container: 'container',
        width: window.innerWidth,
        height: window.innerHeight,
      });

      if (this.stage) {
        const layer = new Konva.Layer();
        this.stage.add(layer);

        this.selectedLayer = this.stage.getLayers()[0];
        this.selectedLayer.draw();
      }

      callback();
    }, 0)
  }

  addEventListeners() {
    if(!this.stage) {
      return;
    }
    let outerThis = this;

    if(!this.selectedLayer) {
      return;
    }

    this.stage.on('click', (event) => {
      console.log('Click event on stage!', event);
      const pointerPosition = this.stage?.getRelativePointerPosition();
      console.log('selected shape ' + this.selectedShape);
      if (pointerPosition && this.selectedShape) {
        this.drawShape(this.selectedShape, pointerPosition.x, pointerPosition.y);
      }
    })
  }

  drawShape(shapeType: ShapeType, x: number, y: number) {
    console.log('drawShape', shapeType, x, y);
    if(this.stage && this.selectedLayer) {
      let shape;
      switch(shapeType) {
        case ShapeType.RECTANGLE:
          shape = new RectangleShape(this.stage, x, y, 50, 50);
          break;
        default:
          break;
      }

      if(!shape) {
        return;
      }
      
      shape.draw(this.selectedLayer);
    }
  }

  shapeMenuItemDragStarted(shapeType: ShapeType, e?: Event) {
    this.selectedShape = shapeType;
  }

  onDrop(e: Event) {
    console.log('On drop', e);
    e.preventDefault();
    if(!this.stage || !this.selectedShape) {
      return;
    }
      this.stage.setPointersPositions(e);
      if(this.stage.pointerPos) {
        this.drawShape(this.selectedShape, this.stage.pointerPos?.x, this.stage.pointerPos.y)
      }
  }

  onDragOver(e: Event) {
    e.preventDefault();
  }

}
