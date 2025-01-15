import Konva from 'konva';

export class ZoomManager {
  public stage: Konva.Stage;
  public zoomLayers: Konva.Layer[] = [];
  public scrollEventsPerTransition: number; 
  public zoomLevel: number = 1; 
  public minScale: number = 0.5; 
  public maxScale: number = 3; 
  public initialScale: number; 
  public currentScrollEvents: number = 0; 

  constructor(stage: Konva.Stage, scrollEventsPerTransition: number) {
    this.stage = stage;
    this.scrollEventsPerTransition = scrollEventsPerTransition;

    // Dynamically calculate the number of zoom levels
    const zoomLevelsCount = this.calculateZoomLevelsCount();
    for (let i = 0; i < zoomLevelsCount; i++) {
      const layer = new Konva.Layer();
      this.zoomLayers.push(layer);
      this.stage.add(layer);
    }

    // Set the initial scale
    this.initialScale = this.maxScale;
    this.stage.scale({ x: this.initialScale, y: this.initialScale });

    // Start with zero scroll events
    this.currentScrollEvents = 0;
    this.updateLayersVisibility(this.initialScale);
  }

  /**
   * Calculate the number of zoom levels dynamically based on the scale range and scroll events per transition.
   * @returns {number} The number of zoom levels.
   */
  calculateZoomLevelsCount(): number {
    const totalScaleRange = this.maxScale - this.minScale; // The difference between max and min scale
    const stepSize = totalScaleRange / this.scrollEventsPerTransition; // Scale step size for each transition
    return Math.ceil(totalScaleRange / stepSize) + 1; // Number of zoom levels
  }

  /**
   * Handle the mouse wheel event for zooming.
   * @param event - The WheelEvent triggered by the user.
   */
  handleWheelEvent(event: WheelEvent) {
    event.preventDefault();

    const pointerPosition = this.stage.getPointerPosition();
    if (!pointerPosition) return;

    const oldScale = this.stage.scaleX(); // Current scale
    const direction = event.deltaY > 0 ? 1 : -1; // Determine scroll direction (zoom in or out)

    // Update the current number of scroll events
    const maxScrollEvents = this.scrollEventsPerTransition * (this.zoomLayers.length - 1);
    this.currentScrollEvents = Math.min(
      Math.max(this.currentScrollEvents + direction, 0),
      maxScrollEvents
    );

    // Calculate the new scale based on the number of scroll events
    const stepSize = (this.maxScale - this.minScale) / (this.zoomLayers.length - 1);
    const newScale = this.maxScale - (this.currentScrollEvents / this.scrollEventsPerTransition) * stepSize;

    // Calculate the zoom center relative to the stage position
    const stagePosition = this.stage.position();
    const pointerRelativeToStage = {
      x: (pointerPosition.x - stagePosition.x) / oldScale,
      y: (pointerPosition.y - stagePosition.y) / oldScale,
    };

    const newStagePosition = {
      x: pointerPosition.x - pointerRelativeToStage.x * newScale,
      y: pointerPosition.y - pointerRelativeToStage.y * newScale,
    };

    // Update the stage scale and position
    this.stage.scale({ x: newScale, y: newScale });
    this.stage.position(newStagePosition);
    this.stage.batchDraw();

    // Calculate the new zoom level
    const newZoomLevel = Math.floor(this.currentScrollEvents / this.scrollEventsPerTransition) + 1;
    if (newZoomLevel !== this.zoomLevel) {
      this.zoomLevel = Math.min(Math.max(newZoomLevel, 1), this.zoomLayers.length);
      this.updateLayersVisibility(newScale);
    }

  }

  /**
   * Update the visibility and opacity of layers based on the current zoom level.
   * @param scale - The current scale of the stage.
   */
  updateLayersVisibility(scale: number) {
    const zoomLevel = this.zoomLevel;

    this.zoomLayers.forEach((layer, index) => {
      const opacity = Math.max(0, 1 - Math.abs(index + 1 - zoomLevel) / this.zoomLayers.length);
      layer.to({
        opacity: opacity,
        duration: 0.5,
        easing: Konva.Easings.EaseOut,
      });
      layer.visible(opacity > 0);
    });
}
}
