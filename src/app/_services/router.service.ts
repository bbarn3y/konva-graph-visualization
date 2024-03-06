/*
 * <<licensetext>>
 */

import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PageRoutes } from '../_constants/page-routes';
import { Location } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class RouterService {
  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router
  ) {}

  routeToEditor() {
    this.router.navigateByUrl(`/${PageRoutes.editor}`);
  }
}
