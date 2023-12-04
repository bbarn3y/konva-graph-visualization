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
  static IdCount = 1;
  selectRectangle?: Konva.Rect;
  groups: Konva.Group[] = [];
  //currentShape?: Konva.Shape;
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
    //this.updateGrid();
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
      //scaleY: 1,
      //y: this.windowHeight,
      // draggable: false
    })
      console.log(this.stage.scaleY(), this.stage.y())
      if (this.stage) {
        this.gridLayer = new Konva.Layer();
        //this.stage.add(this.gridLayer);
        const layer = new Konva.Layer();
        this.stage.add(layer);
        console.log('stage', this.stage.getLayers());
        this.selectedLayer = this.stage.getLayers()[0];
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

    if(!this.selectedLayer) {
      return;
    }

    this.stage.on('click', (event) => {
      const pointerPosition = this.stage?.getRelativePointerPosition();
      if (!pointerPosition) return;
      console.log('Clicked on stage', pointerPosition);
      const snapPos = this.calculateGridSnapPosition(pointerPosition);
      if (this.selectedShape) {
        this.drawShape(this.selectedShape, pointerPosition.x, pointerPosition.y, true);
      }
      const shape = event.target;
      //console.log('groupID ' + shape.attrs.groupId);
      console.log(shape, shape.getType());
      
      
      console.log('sr ', this.selectRectangle);
      

      if (shape instanceof Konva.Shape && event.evt.button !== 2 && !this.selectedShape)
      {
        /*
        if (!shape.attrs.isSelected){
          console.log("not selected");
          
          shape.attrs.selectShape();
        }
        else{
          console.log("selected");
          shape.attrs.unselectShape();
        }
        */
        
        shape.attrs.isSelected = !shape.attrs.isSelected;
    
        if (shape instanceof Konva.Shape) {            
            shape.stroke(shape.attrs.isSelected ? 'yellow' : 'black')
        }
        
        if (shape.attrs.groupId != -1 && shape.attrs.groupId !== undefined){
          if (shape.attrs.isSelected) {
            console.log('bruh ' + shape.attrs.groupId);
            
            const sameGroupShapes = this.stage?.find('Shape').filter(x => x.attrs.groupId === shape.attrs.groupId);
          
            if(!sameGroupShapes) return;
            console.log(shape.attrs.groupId);
            
            sameGroupShapes.forEach(actShape => {
              if (actShape instanceof Konva.Shape && actShape.attrs.groupId !== 'undefined'){
                actShape.attrs.isSelected = true;
                actShape.stroke('yellow');
              }
            });
          }
          else {
            const sameGroupShapes = this.stage?.find('Shape').filter(x => x.attrs.groupId === shape.attrs.groupId);
          
            if(!sameGroupShapes) return;
            
            sameGroupShapes.forEach(actShape => {
              if (actShape instanceof Konva.Shape && actShape.attrs.groupId !== 'undefined'){
                actShape.attrs.isSelected = false;
                actShape.stroke('black');
              }
            });
          }
        }

        
      }
      // else
      // {
      //   const allShapes = this.stage?.find('Shape');
        
      //   if(!allShapes) return;

      //   allShapes.forEach(actShape => {
      //     actShape.attrs.isSelected = false;
      //     if (actShape instanceof Konva.Shape){
      //       actShape.stroke('black');
      //     }
      //   });
      // }

      const contextMenu = document.getElementById('contextMenu');

      if (!contextMenu) return;

      contextMenu.style.display = 'none';
    });
    //@TODO: Should we need to move on stage? If yes we should move by holding middle mouse button
    //Dragging the stage
    // this.stage.on('dragmove', (e) => {
    //   this.rePositionStage();
    // });
    // this.stage.on('dragend', (e) => {
    //   this.rePositionStage();
    // });
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
      this.stage.scale({ x: newScale, y: newScale });

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

    this.stage.on('contextmenu', (e) => {
      // prevent default behavior
      e.evt.preventDefault();
  
      // Check if we are on an empty place of the stage
      if (e.target === this.stage || this.selectedShape) {
        return;
      }

      //        if(!selectedShapes || selectedShapes.length <= 1) return;

  
      const currentShape = e.target;
  
      // Get the context menu element
      const contextMenu = document.getElementById('contextMenu');

      if (contextMenu) {
        // Set position based on the mouse pointer
        contextMenu.style.display = 'block';
        contextMenu.style.top = e.evt.clientY + 'px';
        contextMenu.style.left = e.evt.clientX + 'px';

        
        

        // Handle context menu actions
        document.getElementById('group_button')?.addEventListener('click', () => {
          
          const group = new Konva.Group();
          group.attrs.id = this.getUniqueId(4);

          const selectedShapes = this.stage?.find('Shape').filter(x => x.attrs.isSelected);
        
          if(!selectedShapes) return;
    
          selectedShapes.forEach(actShape => {
          
            if (actShape instanceof Konva.Shape){
              actShape.stroke('black');
              actShape.attrs.groupId = group.attrs.id;
              actShape.attrs.group = group;
              group.add(actShape);
            }
            actShape.attrs.isSelected = false;
          });

          currentShape.attrs.group = group;
          console.log(group.attrs.id);
          
          this.selectedLayer?.add(group);
          this.selectedLayer?.draw();
          this.groups.push(group);
          contextMenu.style.display = 'none';
        });

        document.getElementById('ungroup_button')?.addEventListener('click', () => {
          const group = currentShape.attrs.group;
          const sameGroupShapes = this.stage?.find('Shape').filter(x => x.attrs.group == group);
          
          sameGroupShapes.forEach(actShape => {
            if (actShape instanceof Konva.Shape){
              group.remove(actShape);
              actShape.attrs.group = undefined;
              actShape.stroke('black');
            }
          });
          group.remove(currentShape);
          currentShape.attrs.group = undefined;
          contextMenu.style.display = 'none';
        });

        document.getElementById('delete_button')?.addEventListener('click', () => {
          currentShape.destroy();
          contextMenu.style.display = 'none';
        });

        // Add other context menu options and their respective handlers as needed
      }
    });

    

    this.stage.on('mousedown', (event) => {
      // Store the starting point when the left mouse button is pressed
      if (event.evt.button === 0 && event.evt.shiftKey && !this.selectedShape && !event.evt.ctrlKey) {
        
        const pointerPosition = this.stage?.getPointerPosition();
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

    this.stage.on('mousemove', () => {
      // Update the position and dimensions of the temporary rectangle while dragging
      if (this.selectRectangle) {
        const currentMousePos = this.stage?.getPointerPosition();
        if (currentMousePos) {
          const width = currentMousePos.x - this.selectRectangle.x();
          const height = currentMousePos.y - this.selectRectangle.y();

          this.selectRectangle.width(width);
          this.selectRectangle.height(height);

          this.selectedLayer?.batchDraw();
        }
      }
    });

    this.stage.on('mouseup', (event) => {
      
      // Clear the selection rectangle when the left mouse button is released
      if (event.evt.button === 0 && !this.selectedShape && this.selectRectangle) {

        this.removeSelectionOnShapes();
        const selectedShapes = this.getAllShapesInSelection();

        selectedShapes.forEach(actShape => {
          console.log('inside----------');
          
          actShape.attrs.isSelected = true;
          actShape.stroke('yellow'); 
        });

        this.selectRectangle.destroy();
        this.selectedLayer?.batchDraw();
      }
    });
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
      
      shape.attrs.id = GraphEditorComponent.IdCount++;
      console.log('id ' + shape.id);
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
      y: ((Math.round(vector.y / weightedFieldSize) * weightedFieldSize) + (weightedFieldSize + shapeSize.y) - weightedFieldSize - padding),
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
    console.log(this.stage.scaleY(), this.stage.y())
  }

  //Reposition stage, but the coords are clamped and based on zoom level.
  rePositionStage(pos?: Vector2d) {
    if (!pos) pos = this.stage.position();
    const range: number = this.stage.width();
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

  removeSelectionOnShapes() 
  {
    const allShapes = this.stage?.find('Shape');
    //console.log(allShapes?.length);
    
    if (!allShapes) return;

    allShapes.forEach(actShape => {
      if (actShape.attrs.isSelected === undefined) return;
      if (actShape instanceof Konva.Shape && actShape.attrs.isSelected) {
        actShape.attrs.isSelected = false;
        actShape.stroke('black');
      }
    });
  }

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
  
    allShapes.forEach(shape => {
      if (shape instanceof Konva.Shape) {  // Check if the node is a shape
        // Get the bounding box of the shape
        const shapeBoundingBox = shape.getClientRect();
  
        // Check if all corners of the shape are within the selection rectangle
        const isShapeFullyWithinSelection =
          this.isPointWithinSelection(shapeBoundingBox.x, shapeBoundingBox.y) &&
          this.isPointWithinSelection(shapeBoundingBox.x + shapeBoundingBox.width, shapeBoundingBox.y) &&
          this.isPointWithinSelection(shapeBoundingBox.x + shapeBoundingBox.width, shapeBoundingBox.y + shapeBoundingBox.height) &&
          this.isPointWithinSelection(shapeBoundingBox.x, shapeBoundingBox.y + shapeBoundingBox.height);
  
        if (isShapeFullyWithinSelection) {
          selectedShapes.push(shape);
        }
      }
    });
  
    return selectedShapes;
  }
  
  private isPointWithinSelection(x: number, y: number): boolean {
    const selectionRect = this.selectRectangle;
  
    if (!selectionRect) {
      return false;
    }
  
    const x1 = Math.min(selectionRect.x(), selectionRect.x() + selectionRect.width());
    const x2 = Math.max(selectionRect.x(), selectionRect.x() + selectionRect.width());
    const y1 = Math.min(selectionRect.y(), selectionRect.y() + selectionRect.height());
    const y2 = Math.max(selectionRect.y(), selectionRect.y() + selectionRect.height());
  
    return x >= x1 && x <= x2 && y >= y1 && y <= y2;
  }

  private getUniqueId(parts: number): string {
    const stringArr = [];
    for(let i = 0; i< parts; i++){
      // tslint:disable-next-line:no-bitwise
      const S4 = (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
      stringArr.push(S4);
    }
    return stringArr.join('-');
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
}
