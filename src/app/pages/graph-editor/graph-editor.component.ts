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
  static IdCount = 1;
  selectRectangle?: Konva.Rect;
  groups: Konva.Group[] = [];
  //currentShape?: Konva.Shape;



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
      if (pointerPosition && this.selectedShape) {
        this.drawShape(this.selectedShape, pointerPosition.x, pointerPosition.y);
      }

      const shape = event.target;

      
      if (shape instanceof Konva.Shape && event.evt.ctrlKey && !this.selectedShape)
      {
        shape.attrs.isSelected = !shape.attrs.isSelected;
    
        if (shape instanceof Konva.Shape) {            
            shape.stroke(shape.attrs.isSelected ? 'yellow' : 'black')
        }
      }
      else
      {
        const allShapes = this.stage?.find('Shape');
        
        if(!allShapes) return;

        allShapes.forEach(actShape => {
          actShape.attrs.isSelected = false;
          if (actShape instanceof Konva.Shape){
            actShape.stroke('black');
          }
        });
      }
    })

    this.stage.on('contextmenu', (e) => {
      // prevent default behavior
      e.evt.preventDefault();
  
      // Check if we are on an empty place of the stage
      if (e.target === this.stage || this.selectedShape) {
        return;
      }
  
      const currentShape = e.target;
  
      // Show context menu
      //this.showContextMenu(e.evt);

      if (e.evt.button !== 2) return;

      // Get the context menu element
      const contextMenu = document.getElementById('contextMenu');

      if (contextMenu) {
        // Set position based on the mouse pointer
        contextMenu.style.display = 'block';
        contextMenu.style.top = e.evt.clientY + 'px';
        contextMenu.style.left = e.evt.clientX + 'px';

        
        

        // Handle context menu actions
        document.getElementById('delete_button')?.addEventListener('click', () => {
          console.log("inside");
          currentShape.destroy();
          contextMenu.style.display = 'none';
        });

        // Add other context menu options and their respective handlers as needed
      }
    });

    

    this.stage.on('mousedown', (event) => {
      // Store the starting point when the left mouse button is pressed
      if (event.evt.button === 0 && !this.selectedShape && !event.evt.ctrlKey) {
        
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
      if (event.evt.button === 0 && this.selectRectangle && !event.evt.ctrlKey) {

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
      
      shape.id = GraphEditorComponent.IdCount++;
      console.log('id ' + shape.id);
      
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

  removeSelectionOnShapes() 
  {
    const allShapes = this.stage?.find('Shape');
    //console.log(allShapes?.length);
    
    if(!allShapes) return;

    allShapes.forEach(actShape => {
      actShape.attrs.isSelected = false;
      if (actShape instanceof Konva.Shape){
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
