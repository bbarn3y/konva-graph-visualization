/*
 * <<licensetext>>
 */

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { GraphEditorComponent } from './pages/graph-editor/graph-editor.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [AppComponent, GraphEditorComponent],
  imports: [BrowserModule, AppRoutingModule, RouterModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
