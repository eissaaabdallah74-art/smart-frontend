import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { AuthService } from './services/auth/auth-service.service';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, HeaderComponent, SidebarComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class AppComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  // Signals جايين من AuthService
  user = computed(() => this.auth.currentUser());
  perms = computed(() => this.auth.permissions());

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
