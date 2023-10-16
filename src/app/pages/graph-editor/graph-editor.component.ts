/*
 * <<licensetext>>
 */

import { AfterViewInit, Component } from '@angular/core';
import Konva from "konva";
import Shape = Konva.Shape;
import Group = Konva.Group;

@Component({
  selector: 'app-graph-editor',
  templateUrl: './graph-editor.component.html',
  styleUrls: ['./graph-editor.component.less']
})
export class GraphEditorComponent implements AfterViewInit {
  stage?: Konva.Stage;
  selectedLayer?: Konva.Layer;
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
    })
  }

  addEventListeners() {
    
  }

}
