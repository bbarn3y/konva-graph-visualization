/*
 * <<licensetext>>
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PageRoutes } from './_constants/page-routes';
import { GraphEditorComponent } from './pages/graph-editor/graph-editor.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: PageRoutes.editor,
    pathMatch: 'prefix',
  },
  {
    path: PageRoutes.editor,
    component: GraphEditorComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
