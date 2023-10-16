/*
 * <<licensetext>>
 */

import { Component } from '@angular/core';
import { RouterService } from './_services/router.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent {
  title = 'konva-graph-visualization';

  constructor(public routerService: RouterService) {

  }
}
