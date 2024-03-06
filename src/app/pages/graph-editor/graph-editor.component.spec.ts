import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphEditorComponent } from './graph-editor.component';

describe('GraphEditorComponent', () => {
  let component: GraphEditorComponent;
  let fixture: ComponentFixture<GraphEditorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GraphEditorComponent],
    });
    fixture = TestBed.createComponent(GraphEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
